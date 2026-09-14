/** Shared, format-agnostic helpers for turning bytes and file names into text. */

const REPLACEMENT_RATIO_LIMIT = 0.002;

function decodeWith(bytes: Uint8Array, encoding: string): string {
  return new TextDecoder(encoding).decode(bytes);
}

/**
 * Decode a byte buffer to text, honouring a BOM and falling back to
 * windows-1252 for the many legacy plain-text books that are not UTF-8.
 */
export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return decodeWith(bytes, 'utf-16le');
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return decodeWith(bytes, 'utf-16be');
  }

  const utf8 = decodeWith(bytes, 'utf-8').replace(/^\ufeff/, '');
  const damaged = (utf8.match(/\ufffd/g)?.length ?? 0) / Math.max(utf8.length, 1);
  if (damaged <= REPLACEMENT_RATIO_LIMIT) return utf8;

  try {
    return decodeWith(bytes, 'windows-1252');
  } catch {
    return utf8;
  }
}

/** "the-time-machine.epub" -> "the time machine" (kept as authored otherwise). */
export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, '');
  const cleaned = withoutExtension.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : 'Untitled';
}

export function extensionOf(fileName: string): string {
  const match = /\.([^./\\]+)$/.exec(fileName.toLowerCase());
  return match?.[1] ?? '';
}

/**
 * Read a file as bytes. `File.arrayBuffer` is the modern path; FileReader
 * covers older environments (and jsdom in tests) that still lack it.
 */
export function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('Could not read the file.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsArrayBuffer(file);
  });
}
