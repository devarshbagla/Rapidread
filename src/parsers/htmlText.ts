/** Shared HTML → plain text for HTML files and other markup formats. */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const SKIPPED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'HEAD',
  'TEMPLATE',
  'IFRAME',
  'NAV',
  'FOOTER',
  'HEADER',
]);

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
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'LI',
  'MAIN',
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

function walk(node: Node | null, out: string[]): void {
  if (node === null) return;
  if (node.nodeType === TEXT_NODE) {
    out.push(node.nodeValue ?? '');
    return;
  }
  if (node.nodeType !== ELEMENT_NODE) return;

  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (SKIPPED_TAGS.has(tag)) return;

  const isBlock = BLOCK_TAGS.has(tag);
  if (isBlock) out.push('\n');
  for (const child of element.childNodes) walk(child, out);
  if (isBlock) out.push('\n');
}

/** Turn an HTML string into readable plain text, preserving paragraph breaks. */
export function htmlToText(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const parts: string[] = [];
  walk(document.body, parts);
  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Prefer `<title>`, then the first heading, then the file-derived fallback. */
export function htmlDocumentTitle(html: string, fallback: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const fromTitle = document.querySelector('title')?.textContent?.trim() ?? '';
  if (fromTitle.length > 0) return fromTitle.slice(0, 200);
  const heading = document.querySelector('h1, h2')?.textContent?.trim() ?? '';
  if (heading.length > 0) return heading.slice(0, 200);
  return fallback;
}
