import type { NormalizedBook } from '../types/book';
import { decodeText, readFileBytes, titleFromFileName } from './decode';
import { ImportError, quoted } from './errors';
import { htmlDocumentTitle, htmlToText } from './htmlText';
import { tokenize } from './tokenize';

/** Standalone .html / .htm files. */
export async function parseHtml(file: File): Promise<NormalizedBook> {
  const html = decodeText(await readFileBytes(file));
  const text = htmlToText(html);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    throw new ImportError(
      `${quoted(file.name)} doesn't contain any readable text. Try a different file.`,
    );
  }

  const title = htmlDocumentTitle(html, titleFromFileName(file.name));
  return { title, chapters: [{ title, tokens }] };
}
