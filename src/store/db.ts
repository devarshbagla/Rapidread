import { createStore, del, get, set } from 'idb-keyval';
import type { FormatId } from '../parsers';
import type { AccountUser } from '../sync/session';
import type { NormalizedBook } from '../types/book';
import { normalizeSettings, type Settings } from './settings';
import type { BookSummary, ReadingProgress } from './types';

const KEY_SETTINGS = 'settings';
const KEY_BOOKS = 'books';
const KEY_LAST_BOOK = 'last-book';
const KEY_SESSION = 'session';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function loadSettings(): Promise<Settings> {
  return (await loadSettingsRecord()).settings;
}

export async function loadSettingsRecord(): Promise<{ settings: Settings; updatedAt: number }> {
  const raw = await read<unknown>(KEY_SETTINGS);
  const settings = normalizeSettings(raw);
  const updatedAt = isRecord(raw) && typeof raw.updatedAt === 'number' ? raw.updatedAt : 0;
  return { settings, updatedAt };
}

export async function saveSettings(settings: Settings, updatedAt = Date.now()): Promise<void> {
  await write(KEY_SETTINGS, { ...settings, updatedAt });
}

export async function loadSession(): Promise<{ token: string; user: AccountUser } | undefined> {
  const stored = await read<unknown>(KEY_SESSION);
  if (!isRecord(stored) || typeof stored.token !== 'string' || !isRecord(stored.user)) return undefined;
  const user = stored.user;
  if (typeof user.id !== 'string' || typeof user.username !== 'string') return undefined;
  return {
    token: stored.token,
    user: {
      id: user.id,
      username: user.username,
      email: typeof user.email === 'string' ? user.email : null,
      emailVerified: user.emailVerified === true,
      createdAt: typeof user.createdAt === 'number' ? user.createdAt : 0,
    },
  };
}

export async function saveSession(token: string, user: AccountUser): Promise<void> {
  await write(KEY_SESSION, { token, user });
}

export async function clearSession(): Promise<void> {
  await remove(KEY_SESSION);
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
export async function addBook(
  book: NormalizedBook,
  format: FormatId,
  fingerprint?: string,
): Promise<BookSummary> {
  const summaries = await loadBookSummaries();
  if (fingerprint !== undefined) {
    const existing = summaries.find((summary) => summary.fingerprint === fingerprint);
    if (existing !== undefined) {
      await write(bookKey(existing.id), book);
      return existing;
    }
  }

  const summary: BookSummary = {
    id: newId(),
    title: book.title,
    ...(book.author !== undefined ? { author: book.author } : {}),
    ...(book.coverImage !== undefined ? { coverImage: book.coverImage } : {}),
    wordCount: book.chapters.reduce((total, chapter) => total + chapter.tokens.length, 0),
    chapterCount: book.chapters.length,
    format,
    addedAt: Date.now(),
    ...(fingerprint !== undefined ? { fingerprint } : {}),
  };

  await write(bookKey(summary.id), book);
  await write(KEY_BOOKS, [...summaries, summary]);
  return summary;
}

export async function updateBookSummary(
  id: string,
  patch: Partial<BookSummary>,
): Promise<BookSummary | undefined> {
  const summaries = await loadBookSummaries();
  const index = summaries.findIndex((summary) => summary.id === id);
  if (index === -1) return undefined;
  const current = summaries[index];
  if (current === undefined) return undefined;
  const next = { ...current, ...patch };
  const updated = [...summaries];
  updated[index] = next;
  await write(KEY_BOOKS, updated);
  return next;
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
