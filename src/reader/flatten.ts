import type { NormalizedBook, Token } from '../types/book';

export interface ChapterSpan {
  index: number;
  title: string;
  /** First word index of the chapter. */
  start: number;
  /** One past the chapter's last word index. */
  end: number;
}

/**
 * A book viewed as one continuous word stream. Playback and progress use a
 * single index into `words`; chapters are spans over it, so changing chunk size
 * or jumping around never needs a chapter/token coordinate pair.
 */
export interface FlatBook {
  title: string;
  author?: string;
  words: Token[];
  chapters: ChapterSpan[];
  wordCount: number;
}

export function flattenBook(book: NormalizedBook): FlatBook {
  const words: Token[] = [];
  const chapters: ChapterSpan[] = [];

  for (const chapter of book.chapters) {
    if (chapter.tokens.length === 0) continue;
    const start = words.length;
    for (const token of chapter.tokens) words.push(token);
    chapters.push({ index: chapters.length, title: chapter.title, start, end: words.length });
  }

  return {
    title: book.title,
    ...(book.author !== undefined ? { author: book.author } : {}),
    words,
    chapters,
    wordCount: words.length,
  };
}

const EMPTY_CHAPTER: ChapterSpan = { index: 0, title: '', start: 0, end: 0 };

/** The chapter containing `wordIndex`. */
export function chapterAt(book: FlatBook, wordIndex: number): ChapterSpan {
  const { chapters } = book;
  if (chapters.length === 0) return EMPTY_CHAPTER;

  let low = 0;
  let high = chapters.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (chapters[mid].start <= wordIndex) low = mid;
    else high = mid - 1;
  }
  return chapters[low];
}
