import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectParser, ImportError, parse } from '../parsers';
import { fingerprintBook } from '../sync/fingerprint';
import { pullLibrary, pushBookMeta, pushLastBook } from '../sync/api';
import { getToken, onSessionChange, type RemoteBook } from '../sync/session';
import {
  addBook,
  isStorageDurable,
  loadBookSummaries,
  loadLastBookId,
  loadProgress,
  removeBook,
  saveLastBookId,
  saveProgress,
  updateBookSummary,
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
  /** Cloud titles that are not on this device yet. */
  remoteBooks: RemoteBook[];
  progress: Record<string, ReadingProgress>;
  /** File names currently being parsed. */
  importing: string[];
  failures: ImportFailure[];
  /** False when this browser refused persistent storage. */
  durable: boolean;
  lastBookId: string | undefined;
  importFiles: (files: File[]) => Promise<BookSummary[]>;
  resumeRemote: (remote: RemoteBook, file: File) => Promise<BookSummary | undefined>;
  remove: (id: string) => Promise<void>;
  refreshProgress: () => Promise<void>;
  rememberLastBook: (id: string | undefined) => void;
  dismissFailure: (id: string) => void;
  pullRemote: () => Promise<void>;
}

function shelfRank(progress: ReadingProgress | undefined): number {
  if (progress?.finished === true) return 2;
  return isStarted(progress) ? 0 : 1;
}

function pushMeta(summary: BookSummary): void {
  if (summary.fingerprint === undefined) return;
  void pushBookMeta({
    fingerprint: summary.fingerprint,
    title: summary.title,
    ...(summary.author !== undefined ? { author: summary.author } : {}),
    wordCount: summary.wordCount,
    updatedAt: summary.addedAt,
  });
}

function applyRemoteProgress(
  bookId: string,
  remote: RemoteBook['progress'],
  local: ReadingProgress | undefined,
): ReadingProgress | undefined {
  if (remote === null || remote === undefined) return local;
  if (local !== undefined && local.updatedAt >= remote.updatedAt) return local;
  return {
    bookId,
    wordIndex: remote.wordIndex,
    wordCount: remote.wordCount,
    wpm: remote.wpm,
    finished: remote.finished,
    updatedAt: remote.updatedAt,
  };
}

export function useLibrary(): LibraryApi {
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [remoteBooks, setRemoteBooks] = useState<RemoteBook[]>([]);
  const [progress, setProgress] = useState<Record<string, ReadingProgress>>({});
  const [importing, setImporting] = useState<string[]>([]);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [durable, setDurable] = useState(true);
  const [lastBookId, setLastBookId] = useState<string | undefined>(undefined);
  const bookIds = useRef<string[]>([]);
  const booksRef = useRef<BookSummary[]>([]);

  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  const fail = useCallback((id: string, message: string) => {
    setFailures((current) => [...current.filter((item) => item.message !== message), { id, message }]);
  }, []);

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

  const pullRemote = useCallback(async () => {
    if (getToken() === undefined) {
      setRemoteBooks([]);
      return;
    }
    const cloud = await pullLibrary();
    if (cloud === undefined) return;
    const local = booksRef.current;
    const byFingerprint = new Map(
      local.filter((book) => book.fingerprint !== undefined).map((book) => [book.fingerprint, book]),
    );
    setRemoteBooks(cloud.books.filter((book) => !byFingerprint.has(book.fingerprint)));

    const nextProgress: Record<string, ReadingProgress> = {};
    for (const book of local) {
      if (book.fingerprint === undefined) continue;
      const remote = cloud.books.find((item) => item.fingerprint === book.fingerprint);
      if (remote === undefined) continue;
      const current = (await loadProgress([book.id]))[book.id];
      const merged = applyRemoteProgress(book.id, remote.progress, current);
      if (merged !== undefined) {
        await saveProgress(merged);
        nextProgress[book.id] = merged;
      }
    }
    if (Object.keys(nextProgress).length > 0) {
      setProgress((current) => ({ ...current, ...nextProgress }));
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void pullRemote();
    return onSessionChange(() => {
      void pullRemote();
    });
  }, [ready, pullRemote]);

  const importOne = useCallback(
    async (file: File, expected?: RemoteBook): Promise<BookSummary | undefined> => {
      const parser = detectParser(file);
      const book = await parse(file);
      const fingerprint = await fingerprintBook(book);
      if (expected !== undefined && fingerprint !== expected.fingerprint) {
        throw new ImportError(
          `That file doesn’t look like “${expected.title}”. Try another copy of the same book.`,
        );
      }
      const summary = await addBook(book, parser?.id ?? 'txt', fingerprint);
      if (!bookIds.current.includes(summary.id)) {
        bookIds.current = [...bookIds.current, summary.id];
        setBooks((current) => [...current.filter((item) => item.id !== summary.id), summary]);
      } else if (summary.fingerprint === undefined) {
        const patched = await updateBookSummary(summary.id, { fingerprint });
        if (patched !== undefined) {
          setBooks((current) => current.map((item) => (item.id === patched.id ? patched : item)));
        }
      }
      const remoteProgress = expected?.progress ?? undefined;
      if (getToken() !== undefined) {
        const cloud = await pullLibrary();
        const match = cloud?.books.find((item) => item.fingerprint === fingerprint);
        const merged = applyRemoteProgress(
          summary.id,
          remoteProgress ?? match?.progress ?? null,
          (await loadProgress([summary.id]))[summary.id],
        );
        if (merged !== undefined) {
          await saveProgress(merged);
          setProgress((current) => ({ ...current, [summary.id]: merged }));
        }
        pushMeta({ ...summary, fingerprint });
      } else if (remoteProgress !== undefined && remoteProgress !== null) {
        const merged = applyRemoteProgress(summary.id, remoteProgress, undefined);
        if (merged !== undefined) {
          await saveProgress(merged);
          setProgress((current) => ({ ...current, [summary.id]: merged }));
        }
      }
      return summary;
    },
    [],
  );

  const importFiles = useCallback(
    async (files: File[]): Promise<BookSummary[]> => {
      const added: BookSummary[] = [];
      for (const file of files) {
        setImporting((names) => [...names, file.name]);
        try {
          const summary = await importOne(file);
          if (summary !== undefined) added.push(summary);
        } catch (error) {
          const message =
            error instanceof ImportError
              ? error.message
              : `We couldn\u2019t import \u201c${file.name}\u201d. Try a different copy of the file.`;
          fail(`${Date.now()}-${file.name}`, message);
        } finally {
          setImporting((names) => {
            const index = names.indexOf(file.name);
            if (index === -1) return names;
            return [...names.slice(0, index), ...names.slice(index + 1)];
          });
          setDurable(isStorageDurable());
        }
      }
      void pullRemote();
      return added;
    },
    [fail, importOne, pullRemote],
  );

  const resumeRemote = useCallback(
    async (remote: RemoteBook, file: File): Promise<BookSummary | undefined> => {
      setImporting((names) => [...names, file.name]);
      try {
        const summary = await importOne(file, remote);
        void pullRemote();
        return summary;
      } catch (error) {
        const message =
          error instanceof ImportError
            ? error.message
            : `We couldn\u2019t import \u201c${file.name}\u201d. Try a different copy of the file.`;
        fail(`${Date.now()}-${file.name}`, message);
        return undefined;
      } finally {
        setImporting((names) => {
          const index = names.indexOf(file.name);
          if (index === -1) return names;
          return [...names.slice(0, index), ...names.slice(index + 1)];
        });
        setDurable(isStorageDurable());
      }
    },
    [fail, importOne, pullRemote],
  );

  const remove = useCallback(async (id: string) => {
    await removeBook(id);
    bookIds.current = bookIds.current.filter((bookId) => bookId !== id);
    setBooks((current) => current.filter((book) => book.id !== id));
    setProgress((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
    setLastBookId((current) => (current === id ? undefined : current));
    void pullRemote();
  }, [pullRemote]);

  const rememberLastBook = useCallback((id: string | undefined) => {
    setLastBookId(id);
    void saveLastBookId(id);
    const fingerprint = booksRef.current.find((book) => book.id === id)?.fingerprint;
    if (fingerprint !== undefined) void pushLastBook(fingerprint);
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
    remoteBooks,
    progress,
    importing,
    failures,
    durable,
    lastBookId,
    importFiles,
    resumeRemote,
    remove,
    refreshProgress,
    rememberLastBook,
    dismissFailure,
    pullRemote,
  };
}
