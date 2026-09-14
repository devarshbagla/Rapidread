import { createStore, del, get, set } from 'idb-keyval';
import type { FormatId } from '../parsers';
import type { NormalizedBook } from '../types/book';
import { normalizeSettings, type Settings } from './settings';
import type { BookSummary, ReadingProgress } from './types';

const KEY_SETTINGS = 'settings';
const KEY_BOOKS = 'books';
const KEY_LAST_BOOK = 'last-book';
const bookKey = (id: string) => `book:${id}`;
const progressKey = (id: string) => `progress:${id}`;
const flagKey = (name: string) => `flag:${name}`;

interface Kv {
  get: <T>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
}

function memoryKv(): Kv {
  const map = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => map.get(key) as T | undefined,
    set: async (key, value) => void map.set(key, value),
    del: async (key) => void map.delete(key),
  };
}

let durable = true;
let backend: Kv | undefined;

/**
 * IndexedDB, with an in-memory fallback so a browser that blocks storage
 * (private windows, hardened settings) still runs for the current session.
 */
function kv(): Kv {
  if (backend !== undefined) return backend;
  try {
    const store = createStore('rapidread', 'kv');
    backend = {
      get: (key) => get(key, store),
      set: (key, value) => set(key, value, store),
      del: (key) => del(key, store),
    };
  } catch {
    durable = false;
    backend = memoryKv();
  }
  return backend;
}

/** False once a storage operation has failed: progress will not survive a reload. */
export function isStorageDurable(): boolean {
  return durable;
}

async function read<T>(key: string): Promise<T | undefined> {
  try {
    return await kv().get<T>(key);
  } catch {
    durable = false;
    return undefined;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await kv().set(key, value);
  } catch {
    durable = false;
  }
}

async function remove(key: string): Promise<void> {
  try {
    await kv().del(key);
  } catch {
    durable = false;
  }
}

export async function loadSettings(): Promise<Settings> {
  return normalizeSettings(await read<unknown>(KEY_SETTINGS));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await write(KEY_SETTINGS, settings);
}

export async function loadBookSummaries(): Promise<BookSummary[]> {
  const summaries = await read<BookSummary[]>(KEY_BOOKS);
  return Array.isArray(summaries) ? summaries : [];
}

export async function loadBook(id: string): Promise<NormalizedBook | undefined> {
  return read<NormalizedBook>(bookKey(id));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Persist a freshly parsed book and return the shelf record for it. */
export async function addBook(book: NormalizedBook, format: FormatId): Promise<BookSummary> {
  const summary: BookSummary = {
    id: newId(),
    title: book.title,
    ...(book.author !== undefined ? { author: book.author } : {}),
    ...(book.coverImage !== undefined ? { coverImage: book.coverImage } : {}),
    wordCount: book.chapters.reduce((total, chapter) => total + chapter.tokens.length, 0),
    chapterCount: book.chapters.length,
    format,
    addedAt: Date.now(),
  };

  await write(bookKey(summary.id), book);
  const summaries = await loadBookSummaries();
  await write(KEY_BOOKS, [...summaries, summary]);
  return summary;
}

export async function removeBook(id: string): Promise<void> {
  const summaries = await loadBookSummaries();
  await write(
    KEY_BOOKS,
    summaries.filter((summary) => summary.id !== id),
  );
  await remove(bookKey(id));
  await remove(progressKey(id));
  if ((await loadLastBookId()) === id) await saveLastBookId(undefined);
}

export async function loadProgress(ids: string[]): Promise<Record<string, ReadingProgress>> {
  const entries = await Promise.all(
    ids.map(async (id) => [id, await read<ReadingProgress>(progressKey(id))] as const),
  );
  const map: Record<string, ReadingProgress> = {};
  for (const [id, progress] of entries) {
    if (progress !== undefined) map[id] = progress;
  }
  return map;
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  await write(progressKey(progress.bookId), progress);
}

export async function loadLastBookId(): Promise<string | undefined> {
  return read<string>(KEY_LAST_BOOK);
}

export async function saveLastBookId(id: string | undefined): Promise<void> {
  if (id === undefined) await remove(KEY_LAST_BOOK);
  else await write(KEY_LAST_BOOK, id);
}

export async function loadFlag(name: string): Promise<boolean> {
  return (await read<boolean>(flagKey(name))) === true;
}

export async function saveFlag(name: string, value: boolean): Promise<void> {
  await write(flagKey(name), value);
}
