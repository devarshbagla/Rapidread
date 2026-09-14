import JSZip from 'jszip';
import type { Chapter, NormalizedBook } from '../types/book';
import { readFileBytes, titleFromFileName } from './decode';
import { ImportError, quoted } from './errors';
import { tokenize } from './tokenize';

const CONTAINER_PATH = 'META-INF/container.xml';
const DRM_MARKERS = ['META-INF/encryption.xml', 'META-INF/rights.xml'];
const MAX_COVER_BYTES = 4_000_000;

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Elements whose text is never part of the prose. */
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'HEAD', 'TEMPLATE', 'IFRAME']);

/** Elements that imply a line break around their text. */
const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'CENTER',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TD',
  'TH',
  'TR',
  'UL',
]);

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

interface ManifestItem {
  id: string;
  /** Absolute path inside the archive. */
  path: string;
  mediaType: string;
  properties: string[];
}

/**
 * Thin wrapper over the zip that hides the many ways EPUB hrefs and zip entry
 * names disagree (percent-encoding, leading slashes, casing).
 */
class Archive {
  private readonly entries = new Map<string, JSZip.JSZipObject>();

  constructor(zip: JSZip) {
    zip.forEach((path, entry) => {
      if (!entry.dir) this.entries.set(path, entry);
    });
  }

  get paths(): string[] {
    return [...this.entries.keys()];
  }

  find(path: string): JSZip.JSZipObject | undefined {
    const direct = this.entries.get(path);
    if (direct) return direct;

    const decoded = safeDecode(path);
    const decodedHit = this.entries.get(decoded);
    if (decodedHit) return decodedHit;

    const wanted = decoded.toLowerCase();
    for (const [candidate, entry] of this.entries) {
      if (safeDecode(candidate).toLowerCase() === wanted) return entry;
    }
    return undefined;
  }

  has(path: string): boolean {
    return this.find(path) !== undefined;
  }

  async text(path: string): Promise<string | undefined> {
    return this.find(path)?.async('text');
  }

  async base64(path: string): Promise<string | undefined> {
    return this.find(path)?.async('base64');
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolve a manifest/spine href against the directory holding the OPF. */
export function resolvePath(baseDir: string, href: string): string {
  const withoutFragment = safeDecode(href.split('#')[0] ?? '');
  const rooted = withoutFragment.startsWith('/');
  const segments = (rooted ? withoutFragment.slice(1) : `${baseDir}/${withoutFragment}`).split('/');
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

function directoryOf(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function parseXml(source: string, fileName: string): Document {
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new ImportError(
      `${quoted(fileName)} has a damaged internal structure, so it can't be opened. Try re-downloading the book.`,
    );
  }
  return document;
}

/** Namespace-agnostic lookup: EPUB files use prefixes inconsistently. */
function elements(scope: Document | Element, localName: string): Element[] {
  return [...scope.getElementsByTagNameNS('*', localName)];
}

function firstText(scope: Document | Element, localName: string): string | undefined {
  const text = elements(scope, localName)[0]?.textContent?.trim();
  return text !== undefined && text.length > 0 ? text : undefined;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

interface DocumentContent {
  text: string;
  heading: string;
}

function readContent(html: string): DocumentContent {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const parts: string[] = [];
  walk(document.body, parts);
  return {
    text: parts.join(''),
    heading: collapse(document.querySelector('h1, h2, h3, h4, h5, h6')?.textContent ?? ''),
  };
}

function walk(node: Node | null, out: string[]): void {
  if (node === null) return;
  if (node.nodeType === TEXT_NODE) {
    out.push(node.nodeValue ?? '');
    return;
  }
  if (node.nodeType !== ELEMENT_NODE) return;

  const tag = (node as Element).tagName.toUpperCase();
  if (SKIPPED_TAGS.has(tag)) return;

  const isBlock = BLOCK_TAGS.has(tag);
  if (isBlock) out.push('\n');
  for (const child of node.childNodes) walk(child, out);
  if (isBlock) out.push('\n');
}

async function findOpfPath(archive: Archive, fileName: string): Promise<string> {
  const container = await archive.text(CONTAINER_PATH);
  if (container !== undefined) {
    const rootfile = elements(parseXml(container, fileName), 'rootfile')[0];
    const fullPath = rootfile?.getAttribute('full-path');
    if (fullPath !== null && fullPath !== undefined && fullPath.length > 0) {
      return resolvePath('', fullPath);
    }
  }

  const fallback = archive.paths.find((path) => path.toLowerCase().endsWith('.opf'));
  if (fallback !== undefined) return fallback;

  throw new ImportError(
    `${quoted(fileName)} doesn't look like an EPUB book — its contents list is missing. Try re-downloading it, or import a plain .txt file instead.`,
  );
}

function readManifest(opf: Document, baseDir: string): Map<string, ManifestItem> {
  const manifest = new Map<string, ManifestItem>();
  const manifestElement = elements(opf, 'manifest')[0];
  if (manifestElement === undefined) return manifest;

  for (const item of elements(manifestElement, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id === null || href === null) continue;
    manifest.set(id, {
      id,
      path: resolvePath(baseDir, href),
      mediaType: item.getAttribute('media-type') ?? '',
      properties: (item.getAttribute('properties') ?? '').split(/\s+/).filter(Boolean),
    });
  }
  return manifest;
}

/** Spine order is the reading order; `linear="no"` items are auxiliary. */
function readSpine(opf: Document, manifest: Map<string, ManifestItem>): ManifestItem[] {
  const spineElement = elements(opf, 'spine')[0];
  if (spineElement === undefined) return [];

  const items: ManifestItem[] = [];
  for (const itemref of elements(spineElement, 'itemref')) {
    if (itemref.getAttribute('linear') === 'no') continue;
    const item = manifest.get(itemref.getAttribute('idref') ?? '');
    if (item === undefined) continue;
    if (item.properties.includes('nav')) continue;
    items.push(item);
  }
  return items;
}

/** Chapter titles, keyed by document path, from the EPUB 3 nav or EPUB 2 NCX. */
async function readTocLabels(
  archive: Archive,
  opf: Document,
  manifest: Map<string, ManifestItem>,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();

  const nav = [...manifest.values()].find((item) => item.properties.includes('nav'));
  if (nav !== undefined) {
    const html = await archive.text(nav.path);
    if (html !== undefined) {
      const document = new DOMParser().parseFromString(html, 'text/html');
      const navDir = directoryOf(nav.path);
      for (const anchor of document.querySelectorAll('nav a[href]')) {
        const label = collapse(anchor.textContent ?? '');
        const path = resolvePath(navDir, anchor.getAttribute('href') ?? '');
        if (label.length > 0 && !labels.has(path)) labels.set(path, label);
      }
    }
  }

  const ncxId = elements(opf, 'spine')[0]?.getAttribute('toc');
  const ncx = ncxId !== null && ncxId !== undefined ? manifest.get(ncxId) : undefined;
  if (ncx !== undefined) {
    const xml = await archive.text(ncx.path);
    if (xml !== undefined) {
      try {
        const document = parseXml(xml, ncx.path);
        const ncxDir = directoryOf(ncx.path);
        for (const point of elements(document, 'navPoint')) {
          const label = collapse(firstText(point, 'text') ?? '');
          const src = elements(point, 'content')[0]?.getAttribute('src') ?? '';
          const path = resolvePath(ncxDir, src);
          if (label.length > 0 && !labels.has(path)) labels.set(path, label);
        }
      } catch {
        // A broken NCX only costs us chapter names; keep the book.
      }
    }
  }

  return labels;
}

function readAuthor(opf: Document): string | undefined {
  const metadata = elements(opf, 'metadata')[0];
  if (metadata === undefined) return undefined;

  const creators = elements(metadata, 'creator')
    .map((element) => collapse(element.textContent ?? ''))
    .filter((name) => name.length > 0);
  if (creators.length === 0) return undefined;
  return creators.slice(0, 3).join(', ');
}

function coverCandidate(
  opf: Document,
  manifest: Map<string, ManifestItem>,
): ManifestItem | undefined {
  const items = [...manifest.values()];

  const flagged = items.find((item) => item.properties.includes('cover-image'));
  if (flagged !== undefined) return flagged;

  const metadata = elements(opf, 'metadata')[0];
  const metaId = metadata
    ? elements(metadata, 'meta')
        .find((meta) => meta.getAttribute('name') === 'cover')
        ?.getAttribute('content')
    : undefined;
  const byMeta = metaId !== null && metaId !== undefined ? manifest.get(metaId) : undefined;
  if (byMeta !== undefined && isImage(byMeta)) return byMeta;

  return items.find((item) => isImage(item) && /cover/i.test(`${item.id} ${item.path}`));
}

function isImage(item: ManifestItem): boolean {
  if (item.mediaType.startsWith('image/')) return true;
  const extension = /\.([^.]+)$/.exec(item.path.toLowerCase())?.[1] ?? '';
  return extension in IMAGE_MIME_BY_EXTENSION;
}

async function readCover(
  archive: Archive,
  opf: Document,
  manifest: Map<string, ManifestItem>,
): Promise<string | undefined> {
  const item = coverCandidate(opf, manifest);
  if (item === undefined) return undefined;

  const base64 = await archive.base64(item.path);
  if (base64 === undefined) return undefined;
  // base64 inflates by ~4/3; keep oversized art out of IndexedDB.
  if (base64.length * 0.75 > MAX_COVER_BYTES) return undefined;

  const extension = /\.([^.]+)$/.exec(item.path.toLowerCase())?.[1] ?? '';
  const mime = item.mediaType.startsWith('image/')
    ? item.mediaType
    : (IMAGE_MIME_BY_EXTENSION[extension] ?? 'image/jpeg');
  return `data:${mime};base64,${base64}`;
}

/**
 * Unzip, walk the OPF manifest/spine in reading order, and reduce every XHTML
 * document to clean tokens. Nothing EPUB-specific escapes this module.
 */
export async function parseEpub(file: File): Promise<NormalizedBook> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await readFileBytes(file));
  } catch (error) {
    throw new ImportError(
      `${quoted(file.name)} couldn't be opened — the file appears to be damaged or isn't really an EPUB. Try downloading it again.`,
      { cause: error },
    );
  }

  const archive = new Archive(zip);
  const opfPath = await findOpfPath(archive, file.name);
  const opfSource = await archive.text(opfPath);
  if (opfSource === undefined) {
    throw new ImportError(
      `${quoted(file.name)} is missing part of its contents, so it can't be opened. Try re-downloading the book.`,
    );
  }

  const opf = parseXml(opfSource, file.name);
  const baseDir = directoryOf(opfPath);
  const manifest = readManifest(opf, baseDir);
  const spine = readSpine(opf, manifest);
  const tocLabels = await readTocLabels(archive, opf, manifest);

  const chapters: Chapter[] = [];
  for (const item of spine) {
    const html = await archive.text(item.path);
    if (html === undefined) continue;

    const content = readContent(html);
    const tokens = tokenize(content.text);
    if (tokens.length === 0) continue;

    const label = tocLabels.get(item.path) ?? content.heading;
    chapters.push({
      title: (label.length > 0 ? label : `Chapter ${chapters.length + 1}`).slice(0, 140),
      tokens,
    });
  }

  if (chapters.length === 0) {
    const isProtected = DRM_MARKERS.some((marker) => archive.has(marker));
    throw new ImportError(
      isProtected
        ? `${quoted(file.name)} is copy-protected, so its text can't be read. Import a DRM-free EPUB instead.`
        : `We couldn't find any readable text in ${quoted(file.name)} — the pages may be scanned images. Try an EPUB whose text you can select and copy.`,
    );
  }

  const metadata = elements(opf, 'metadata')[0];
  const title = (metadata ? firstText(metadata, 'title') : undefined) ?? titleFromFileName(file.name);
  const author = readAuthor(opf);
  const coverImage = await readCover(archive, opf, manifest);

  return {
    title: collapse(title).slice(0, 200),
    ...(author !== undefined ? { author } : {}),
    ...(coverImage !== undefined ? { coverImage } : {}),
    chapters,
  };
}
