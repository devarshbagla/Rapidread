import type { NormalizedBook } from '../types/book';
import { extensionOf } from './decode';
import { ImportError, quoted, toImportError } from './errors';
import { parseDocx } from './docx';
import { parseEpub } from './epub';
import { parseHtml } from './html';
import { parseImage } from './image';
import { parseMarkdown } from './md';
import { parsePdf } from './pdf';
import { parseTxt } from './txt';

export { ImportError } from './errors';

export type FormatId = 'txt' | 'epub' | 'pdf' | 'docx' | 'md' | 'html' | 'image';

export interface FormatParser {
  id: FormatId;
  /** How the format is named to the reader, e.g. in error copy. */
  label: string;
  extensions: string[];
  mimeTypes: string[];
  parse: (file: File) => Promise<NormalizedBook>;
}

/**
 * The format registry. Supporting a new format is exactly one new module in
 * this directory plus one entry here — the reader, the store and the UI never
 * learn that it exists.
 */
const PARSERS: readonly FormatParser[] = [
  {
    id: 'txt',
    label: 'Plain text',
    extensions: ['txt', 'text'],
    mimeTypes: ['text/plain'],
    parse: parseTxt,
  },
  {
    id: 'epub',
    label: 'EPUB',
    extensions: ['epub'],
    mimeTypes: ['application/epub+zip', 'application/epub'],
    parse: parseEpub,
  },
  {
    id: 'pdf',
    label: 'PDF',
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    parse: parsePdf,
  },
  {
    id: 'docx',
    label: 'Word',
    extensions: ['docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    parse: parseDocx,
  },
  {
    id: 'md',
    label: 'Markdown',
    extensions: ['md', 'markdown'],
    mimeTypes: ['text/markdown', 'text/x-markdown'],
    parse: parseMarkdown,
  },
  {
    id: 'html',
    label: 'HTML',
    extensions: ['html', 'htm'],
    mimeTypes: ['text/html'],
    parse: parseHtml,
  },
  {
    id: 'image',
    label: 'Image',
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'],
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'],
    parse: parseImage,
  },
];

/** Value for an `<input type="file">` accept attribute. */
export const ACCEPTED_FILE_TYPES = PARSERS.flatMap((parser) => [
  ...parser.extensions.map((extension) => `.${extension}`),
  ...parser.mimeTypes,
]).join(',');

/** Used in empty states and error copy. */
export const SUPPORTED_FORMATS_LABEL = '.txt, .epub, .pdf, .docx, .md, .html, or images';

export function detectParser(file: File): FormatParser | undefined {
  const extension = extensionOf(file.name);
  const byExtension = PARSERS.find((parser) => parser.extensions.includes(extension));
  if (byExtension !== undefined) return byExtension;

  const mime = file.type.toLowerCase();
  if (mime.length === 0) return undefined;
  return PARSERS.find((parser) => parser.mimeTypes.includes(mime));
}

function unsupportedFormatError(file: File): ImportError {
  const extension = extensionOf(file.name);
  const named = extension.length > 0 ? `.${extension} files aren't` : "That kind of file isn't";
  return new ImportError(
    `${named} supported yet. Convert ${quoted(file.name)} to ${SUPPORTED_FORMATS_LABEL} and try again.`,
  );
}

/**
 * Parse any supported file into the normalized book format. Every failure path
 * throws an `ImportError` whose message is safe to show as-is.
 */
export async function parse(file: File): Promise<NormalizedBook> {
  const parser = detectParser(file);
  if (parser === undefined) throw unsupportedFormatError(file);

  let book: NormalizedBook;
  try {
    book = await parser.parse(file);
  } catch (error) {
    throw toImportError(error, file.name);
  }

  const hasWords = book.chapters.some((chapter) => chapter.tokens.length > 0);
  if (!hasWords) {
    throw new ImportError(
      `We couldn't find any readable text in ${quoted(file.name)}. Try a different copy of the book.`,
    );
  }
  return book;
}
