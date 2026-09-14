import { useEffect, useState } from 'react';
import { loadBook, loadProgress } from '../store/db';
import type { ReadingProgress } from '../store/types';
import { flattenBook, type FlatBook } from './flatten';

export type BookContent =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; book: FlatBook; progress: ReadingProgress | undefined };

interface LoadedContent {
  bookId: string;
  content: BookContent;
}

/** Load a book's content from storage and flatten it for playback. */
export function useBookContent(bookId: string): BookContent {
  const [loaded, setLoaded] = useState<LoadedContent | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [stored, progressById] = await Promise.all([loadBook(bookId), loadProgress([bookId])]);
      if (!active) return;
      setLoaded({
        bookId,
        content:
          stored === undefined
            ? { status: 'missing' }
            : { status: 'ready', book: flattenBook(stored), progress: progressById[bookId] },
      });
    })();

    return () => {
      active = false;
    };
  }, [bookId]);

  // Derived rather than reset in an effect, so switching books never renders
  // the previous book's content.
  return loaded?.bookId === bookId ? loaded.content : { status: 'loading' };
}
