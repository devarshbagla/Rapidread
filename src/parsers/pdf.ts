import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { NormalizedBook } from '../types/book';
import { readFileBytes, titleFromFileName } from './decode';
import { ImportError, quoted } from './errors';
import { looksLikeScannedPdf, recognizeText } from './ocr';
import { tokenize } from './tokenize';

GlobalWorkerOptions.workerSrc = pdfWorker;

/** Digital PDFs use embedded text; scanned PDFs fall back to page OCR. */
export async function parsePdf(file: File): Promise<NormalizedBook> {
  const bytes = await readFileBytes(file);

  let pdf: PDFDocumentProxy;
  try {
    pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  } catch (error) {
    throw new ImportError(
      `${quoted(file.name)} couldn't be opened as a PDF. The file may be damaged or password-protected.`,
      { cause: error },
    );
  }

  try {
    const embedded = await extractEmbeddedText(pdf);
    const text =
      looksLikeScannedPdf(embedded, pdf.numPages) || embedded.trim().length === 0
        ? await ocrPdfPages(pdf, file.name)
        : embedded;

    const tokens = tokenize(text);
    if (tokens.length === 0) {
      throw new ImportError(
        `We couldn't find any readable text in ${quoted(file.name)}. If it's a scan, try a clearer copy, or OCR it to .txt first.`,
      );
    }

    const title = titleFromFileName(file.name);
    return { title, chapters: [{ title, tokens }] };
  } finally {
    await pdf.cleanup();
  }
}

async function extractEmbeddedText(pdf: PDFDocumentProxy): Promise<string> {
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (line.length > 0) pages.push(line);
  }
  return pages.join('\n\n');
}

async function ocrPdfPages(pdf: PDFDocumentProxy, fileName: string): Promise<string> {
  if (typeof document === 'undefined') {
    throw new ImportError(
      `${quoted(fileName)} looks like a scanned PDF, and OCR needs a browser page to run.`,
    );
  }

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new ImportError(`We couldn't prepare ${quoted(fileName)} for OCR.`);
    }

    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const text = await recognizeText(canvas, `${fileName} (page ${pageNumber})`);
    if (text.length > 0) pages.push(text);
  }

  return pages.join('\n\n');
}
