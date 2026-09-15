import { createWorker, type Worker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
// Pin one core build so Vite can resolve the wasm URL. Auto SIMD selection
// needs a CDN directory; we prefer a local path for offline reliability.
import corePath from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import { ImportError, quoted } from './errors';

let sharedWorker: Worker | null = null;
let workerPending: Promise<Worker> | null = null;

/** Bundled eng model under `public/tessdata/` (respects GitHub Pages base). */
function langPath(): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  // Path only — `new URL(..., base)` needs an absolute URL, and BASE_URL is a path.
  return `${prefix}tessdata`.replace(/\/$/, '');
}

async function getWorker(): Promise<Worker> {
  if (sharedWorker !== null) return sharedWorker;
  if (workerPending !== null) return workerPending;

  workerPending = (async () => {
    const worker = await createWorker('eng', 1, {
      workerPath,
      corePath,
      langPath: langPath(),
      gzip: true,
    });
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
