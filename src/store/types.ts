import type { FormatId } from '../parsers';

/**
 * What the Library needs to draw a shelf. Kept separate from the book's tokens
 * so opening the app never loads a megabyte of prose per book.
 */
export interface BookSummary {
  id: string;
  title: string;
  author?: string;
  coverImage?: string;
  wordCount: number;
  chapterCount: number;
  format: FormatId;
  addedAt: number;
  /** SHA-256 of canonical text; used to resume the same book on another device. */
  fingerprint?: string;
}

export interface ReadingProgress {
  bookId: string;
  /** Index into the book's flattened word list. */
  wordIndex: number;
  wordCount: number;
  /** Last speed used for this book, so it reopens where it left off. */
  wpm: number;
  finished: boolean;
  updatedAt: number;
}

export function progressFraction(progress: ReadingProgress | undefined): number {
  if (progress === undefined || progress.wordCount === 0) return 0;
  if (progress.finished) return 1;
  return Math.min(1, progress.wordIndex / progress.wordCount);
}

export function isStarted(progress: ReadingProgress | undefined): boolean {
  return progress !== undefined && !progress.finished && progress.wordIndex > 0;
}
