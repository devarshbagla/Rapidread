import { createWorker, type Worker } from 'tesseract.js';
import { ImportError, quoted } from './errors';

let sharedWorker: Worker | null = null;
let workerPending: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (sharedWorker !== null) return sharedWorker;
  if (workerPending !== null) return workerPending;

  workerPending = (async () => {
    const worker = await createWorker('eng');
    sharedWorker = worker;
    workerPending = null;
    return worker;
  })();

  return workerPending;
}

/**
 * Run OCR on an image File, Blob, or canvas. English only for now — enough for
 * most books and screenshots, and it keeps the first download small.
 */
export async function recognizeText(
  source: File | Blob | HTMLCanvasElement,
  fileName: string,
): Promise<string> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(source);
    return result.data.text.replace(/\s+/g, ' ').trim();
  } catch (error) {
    throw new ImportError(
      `We couldn't read text from ${quoted(fileName)}. Try a clearer image, or convert the file to .txt.`,
      { cause: error },
    );
  }
}

/** True when a PDF looks like a scan: almost no extractable text per page. */
export function looksLikeScannedPdf(text: string, pageCount: number): boolean {
  const pages = Math.max(1, pageCount);
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  return letters / pages < 40;
}
