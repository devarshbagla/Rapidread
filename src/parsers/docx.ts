import JSZip from 'jszip';
import type { NormalizedBook } from '../types/book';
import { readFileBytes, titleFromFileName } from './decode';
import { ImportError, quoted } from './errors';
import { tokenize } from './tokenize';

const DOCUMENT_PATH = 'word/document.xml';

/**
 * DOCX is a zip of XML. We only need `word/document.xml`: paragraphs (`w:p`)
 * become line breaks, and `w:t` runs are the visible words.
 */
export async function parseDocx(file: File): Promise<NormalizedBook> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await readFileBytes(file));
  } catch (error) {
    throw new ImportError(
      `${quoted(file.name)} doesn't look like a Word document. Try re-saving it as .docx, or export a .txt.`,
      { cause: error },
    );
  }

  const entry = zip.file(DOCUMENT_PATH);
  if (entry === null) {
    throw new ImportError(
      `${quoted(file.name)} is missing its document body. Try opening it in Word and saving a fresh .docx copy.`,
    );
  }

  const xml = await entry.async('text');
  const text = docxXmlToText(xml);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    throw new ImportError(
      `${quoted(file.name)} doesn't contain any readable text. Scanned Word files need to be OCR'd first.`,
    );
  }

  const title = titleFromFileName(file.name);
  return { title, chapters: [{ title, tokens }] };
}

function docxXmlToText(xml: string): string {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') !== null) {
    throw new ImportError('This Word document is damaged and its text could not be read.');
  }

  const parts: string[] = [];
  for (const paragraph of document.getElementsByTagName('w:p')) {
    const runs: string[] = [];
    for (const node of paragraph.getElementsByTagName('w:t')) {
      runs.push(node.textContent ?? '');
    }
    const line = runs.join('');
    if (line.trim().length > 0) parts.push(line);
  }

  return parts.join('\n\n').trim();
}
