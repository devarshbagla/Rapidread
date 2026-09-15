import type { NormalizedBook } from '../types/book';
import { titleFromFileName } from './decode';
import { ImportError, quoted } from './errors';
import { recognizeText } from './ocr';
import { tokenize } from './tokenize';

/**
 * Photos and screenshots of text. OCR runs entirely in the browser via
 * Tesseract — nothing is uploaded.
 */
export async function parseImage(file: File): Promise<NormalizedBook> {
  const text = await recognizeText(file, file.name);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    throw new ImportError(
      `We couldn't find any readable text in ${quoted(file.name)}. Try a sharper photo, or type the text into a .txt file.`,
    );
  }

  const title = titleFromFileName(file.name);
  return { title, chapters: [{ title, tokens }] };
}
