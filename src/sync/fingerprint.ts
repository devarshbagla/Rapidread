import type { NormalizedBook } from '../types/book';

function bytesToHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let hex = '';
  for (const byte of view) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Stable id for a parsed book, independent of filename or the local UUID.
 * Two copies of the same text should match across devices.
 */
export async function fingerprintBook(book: NormalizedBook): Promise<string> {
  const parts: string[] = [book.title.trim().toLowerCase(), (book.author ?? '').trim().toLowerCase()];
  for (const chapter of book.chapters) {
    parts.push(chapter.title);
    for (const token of chapter.tokens) parts.push(token.text);
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\0')));
  return bytesToHex(digest);
}
