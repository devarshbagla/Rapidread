import type { NormalizedBook } from '../types/book';
import { extensionOf } from './decode';
import { ImportError, quoted, toImportError } from './errors';
import { parseEpub } from './epub';
import { parseTxt } from './txt';

export { ImportError } from './errors';

export type FormatId = 'txt' | 'epub';

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
];

/** Value for an `<input type="file">` accept attribute. */
export const ACCEPTED_FILE_TYPES = PARSERS.flatMap((parser) => [
  ...parser.extensions.map((extension) => `.${extension}`),
  ...parser.mimeTypes,
]).join(',');

/** "TXT or EPUB" — used in empty states and error copy. */
export const SUPPORTED_FORMATS_LABEL = '.txt or .epub';

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
