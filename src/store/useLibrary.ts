import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectParser, ImportError, parse } from '../parsers';
import {
  addBook,
  isStorageDurable,
  loadBookSummaries,
  loadLastBookId,
  loadProgress,
  removeBook,
  saveLastBookId,
} from './db';
import { isStarted, type BookSummary, type ReadingProgress } from './types';

export interface ImportFailure {
  id: string;
  message: string;
}

export interface LibraryApi {
  ready: boolean;
  /** Shelf order: in progress, then unread, then finished. */
  books: BookSummary[];
  progress: Record<string, ReadingProgress>;
  /** File names currently being parsed. */
  importing: string[];
  failures: ImportFailure[];
  /** False when this browser refused persistent storage. */
  durable: boolean;
  lastBookId: string | undefined;
  importFiles: (files: File[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refreshProgress: () => Promise<void>;
  rememberLastBook: (id: string | undefined) => void;
  dismissFailure: (id: string) => void;
}

function shelfRank(progress: ReadingProgress | undefined): number {
  if (progress?.finished === true) return 2;
  return isStarted(progress) ? 0 : 1;
}

export function useLibrary(): LibraryApi {
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, ReadingProgress>>({});
  const [importing, setImporting] = useState<string[]>([]);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [durable, setDurable] = useState(true);
  const [lastBookId, setLastBookId] = useState<string | undefined>(undefined);
  const bookIds = useRef<string[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [summaries, storedLastBookId] = await Promise.all([
        loadBookSummaries(),
        loadLastBookId(),
      ]);
      const progressById = await loadProgress(summaries.map((summary) => summary.id));
      if (!active) return;
      bookIds.current = summaries.map((summary) => summary.id);
      setBooks(summaries);
      setProgress(progressById);
      setLastBookId(storedLastBookId);
      setDurable(isStorageDurable());
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshProgress = useCallback(async () => {
    const next = await loadProgress(bookIds.current);
    setProgress(next);
  }, []);

  const importFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      setImporting((names) => [...names, file.name]);
      try {
        const parser = detectParser(file);
        const book = await parse(file);
        const summary = await addBook(book, parser?.id ?? 'txt');
        bookIds.current = [...bookIds.current, summary.id];
        setBooks((current) => [...current, summary]);
      } catch (error) {
        const message =
          error instanceof ImportError
            ? error.message
            : `We couldn\u2019t import \u201c${file.name}\u201d. Try a different copy of the file.`;
        setFailures((current) => [
          ...current.filter((failure) => failure.message !== message),
          { id: `${Date.now()}-${file.name}`, message },
        ]);
      } finally {
        setImporting((names) => {
          const index = names.indexOf(file.name);
          if (index === -1) return names;
          return [...names.slice(0, index), ...names.slice(index + 1)];
        });
        setDurable(isStorageDurable());
      }
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    await removeBook(id);
    bookIds.current = bookIds.current.filter((bookId) => bookId !== id);
    setBooks((current) => current.filter((book) => book.id !== id));
    setProgress((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
    setLastBookId((current) => (current === id ? undefined : current));
  }, []);

  const rememberLastBook = useCallback((id: string | undefined) => {
    setLastBookId(id);
    void saveLastBookId(id);
  }, []);

  const dismissFailure = useCallback((id: string) => {
    setFailures((current) => current.filter((failure) => failure.id !== id));
  }, []);

  const ordered = useMemo(() => {
    return [...books].sort((a, b) => {
      const rankDelta = shelfRank(progress[a.id]) - shelfRank(progress[b.id]);
      if (rankDelta !== 0) return rankDelta;
      const aTime = progress[a.id]?.updatedAt ?? a.addedAt;
      const bTime = progress[b.id]?.updatedAt ?? b.addedAt;
      return bTime - aTime;
    });
  }, [books, progress]);

  return {
    ready,
    books: ordered,
    progress,
    importing,
    failures,
    durable,
    lastBookId,
    importFiles,
    remove,
    refreshProgress,
    rememberLastBook,
    dismissFailure,
  };
}
