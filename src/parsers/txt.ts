import type { NormalizedBook } from '../types/book';
import { decodeText, readFileBytes, titleFromFileName } from './decode';
import { ImportError, quoted } from './errors';
import { tokenize } from './tokenize';

/**
 * Plain text: split on whitespace into one synthetic chapter. There is no
 * structure to recover, so there is none to invent.
 */
export async function parseTxt(file: File): Promise<NormalizedBook> {
  const text = decodeText(await readFileBytes(file));
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    throw new ImportError(
      `${quoted(file.name)} is empty, so there is nothing to read. Pick a text file with words in it.`,
    );
  }

  const title = titleFromFileName(file.name);
  return { title, chapters: [{ title, tokens }] };
}
