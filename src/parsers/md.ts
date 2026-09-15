import type { NormalizedBook } from '../types/book';
import { decodeText, readFileBytes, titleFromFileName } from './decode';
import { ImportError, quoted } from './errors';
import { markdownToText } from './markdown';
import { tokenize } from './tokenize';

/** Markdown (.md / .markdown) → one chapter of plain reading tokens. */
export async function parseMarkdown(file: File): Promise<NormalizedBook> {
  const source = decodeText(await readFileBytes(file));
  const text = markdownToText(source);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    throw new ImportError(
      `${quoted(file.name)} doesn't contain any readable text after removing Markdown markup.`,
    );
  }

  const title = titleFromFileName(file.name);
  return { title, chapters: [{ title, tokens }] };
}
