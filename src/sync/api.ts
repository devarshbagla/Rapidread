import type { Settings } from '../store/settings';
import type { AccountUser, RemoteBook } from './session';
import { getToken } from './session';

export function apiBase(): string {
  const value = import.meta.env.VITE_API_URL;
  if (typeof value !== 'string') return '';
  return value.replace(/\/$/, '');
}

/** Empty base means same origin — the Cloudflare Worker hosts the UI and `/auth`. */
export function accountRequestUrl(path: string, base = apiBase()): string {
  return `${base}${path}`;
}

export function isApiConfigured(): boolean {
  if (apiBase().length > 0) return true;
  if (typeof window === 'undefined') return false;
  const { hostname, port } = window.location;
  if (hostname.endsWith('github.io')) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return port === '8787';
  return true;
}

interface ApiResult<T> {
  ok: boolean;
  status: number;
  body: T;
}

export class ApiError extends Error {
  readonly status: number;
  readonly hint?: string;

  constructor(message: string, status: number, hint?: string) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (!isApiConfigured()) throw new ApiError('Accounts are not configured in this build.', 503);

  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(accountRequestUrl(path), { ...init, headers });
  } catch {
    throw new ApiError('Could not reach the Rapidread server.', 0);
  }

  let body: T = {} as T;
  try {
    body = (await response.json()) as T;
  } catch {
    /* empty */
  }
  return { ok: response.ok, status: response.status, body };
}

function fail(body: { error?: string; hint?: string }, status: number): never {
  throw new ApiError(body.error ?? 'Something went wrong.', status, body.hint);
}

interface AuthResponse {
  token?: string;
  user?: AccountUser;
  error?: string;
  hint?: string;
  sent?: boolean;
  message?: string;
}

export async function registerAccount(
  username: string,
  password: string,
  email: string,
): Promise<{ token: string; user: AccountUser }> {
  const { ok, status, body } = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, email: email.trim() === '' ? undefined : email }),
  });
  if (!ok || body.token === undefined || body.user === undefined) fail(body, status);
  return { token: body.token, user: body.user };
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<{ token: string; user: AccountUser }> {
  const { ok, status, body } = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!ok || body.token === undefined || body.user === undefined) fail(body, status);
  return { token: body.token, user: body.user };
}

export async function fetchMe(): Promise<AccountUser> {
  const { ok, status, body } = await request<AuthResponse>('/auth/me');
  if (!ok || body.user === undefined) fail(body, status);
  return body.user;
}

export async function saveAccountEmail(email: string): Promise<{
  user: AccountUser;
  sent: boolean;
  message: string;
}> {
  const { ok, status, body } = await request<AuthResponse>('/auth/email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (!ok || body.user === undefined) fail(body, status);
  return { user: body.user, sent: body.sent === true, message: body.message ?? '' };
}

export async function verifyAccountEmail(token: string): Promise<{ token: string; user: AccountUser }> {
  const { ok, status, body } = await request<AuthResponse>('/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!ok || body.token === undefined || body.user === undefined) fail(body, status);
  return { token: body.token, user: body.user };
}

export async function forgotPassword(username: string): Promise<{ recovery: string; message: string }> {
  const { ok, status, body } = await request<{
    error?: string;
    recovery?: string;
    message?: string;
  }>('/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
  if (!ok) fail(body, status);
  return { recovery: body.recovery ?? 'unknown', message: body.message ?? '' };
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ token: string; user: AccountUser }> {
  const { ok, status, body } = await request<AuthResponse>('/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  if (!ok || body.token === undefined || body.user === undefined) fail(body, status);
  return { token: body.token, user: body.user };
}

export async function pullSettings(): Promise<{ settings: Settings | null; updatedAt: number } | undefined> {
  if (getToken() === undefined) return undefined;
  const { ok, body } = await request<{ settings: Settings | null; updatedAt: number; error?: string }>(
    '/sync/settings',
  );
  if (!ok) return undefined;
  return body;
}

export async function pushSettings(settings: Settings, updatedAt: number): Promise<void> {
  if (getToken() === undefined) return;
  try {
    await request('/sync/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings, updatedAt }),
    });
  } catch {
    /* offline: local copy is enough */
  }
}

export async function pullLibrary(): Promise<{ lastBookFingerprint: string | null; books: RemoteBook[] } | undefined> {
  if (getToken() === undefined) return undefined;
  const { ok, body } = await request<{
    lastBookFingerprint: string | null;
    books: RemoteBook[];
    error?: string;
  }>('/sync/library');
  if (!ok) return undefined;
  return body;
}

export async function pushBookMeta(input: {
  fingerprint: string;
  title: string;
  author?: string;
  wordCount: number;
  updatedAt: number;
}): Promise<void> {
  if (getToken() === undefined) return;
  try {
    await request('/sync/book-meta', { method: 'PUT', body: JSON.stringify(input) });
  } catch {
    /* offline */
  }
}

export async function pushProgress(input: {
  fingerprint: string;
  wordIndex: number;
  wordCount: number;
  wpm: number;
  finished: boolean;
  updatedAt: number;
}): Promise<void> {
  if (getToken() === undefined) return;
  try {
    await request('/sync/progress', { method: 'PUT', body: JSON.stringify(input) });
  } catch {
    /* offline */
  }
}

export async function pushLastBook(fingerprint: string): Promise<void> {
  if (getToken() === undefined) return;
  try {
    await request('/sync/last-book', {
      method: 'PUT',
      body: JSON.stringify({ fingerprint, updatedAt: Date.now() }),
    });
  } catch {
    /* offline */
  }
}
