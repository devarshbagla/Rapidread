import { normalizeSettings } from '../src/store/settings';
import { requireUser } from './auth';
import { json, type Env } from './http';

function field(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  return typeof value === 'string' ? value : '';
}

function numberField(body: Record<string, unknown>, name: string): number | undefined {
  const value = body[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  } catch {
    /* empty */
  }
  return {};
}

const FINGERPRINT_RE = /^[a-f0-9]{64}$/;

function fingerprintError(value: string): string | undefined {
  if (!FINGERPRINT_RE.test(value)) return 'That book fingerprint is invalid.';
  return undefined;
}

export async function handleSync(
  request: Request,
  env: Env,
  path: string,
  cors: Headers,
): Promise<Response | undefined> {
  if (!path.startsWith('/sync/')) return undefined;

  const authed = await requireUser(request, env, cors);
  if (authed instanceof Response) return authed;
  const userId = authed.user.id;

  if (path === '/sync/settings' && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT payload, updated_at FROM settings WHERE user_id = ?')
      .bind(userId)
      .first<{ payload: string; updated_at: number }>();
    if (row === null) return json({ settings: null, updatedAt: 0 }, 200, cors);
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.payload);
    } catch {
      parsed = null;
    }
    return json({ settings: normalizeSettings(parsed), updatedAt: row.updated_at }, 200, cors);
  }

  if (path === '/sync/settings' && request.method === 'PUT') {
    const body = await readJson(request);
    const settings = normalizeSettings(body.settings);
    const updatedAt = numberField(body, 'updatedAt') ?? Date.now();
    const current = await env.DB.prepare('SELECT updated_at FROM settings WHERE user_id = ?')
      .bind(userId)
      .first<{ updated_at: number }>();
    if (current !== null && current.updated_at > updatedAt) {
      return json({ ignored: true, updatedAt: current.updated_at }, 200, cors);
    }
    await env.DB.prepare(
      'INSERT INTO settings (user_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
    )
      .bind(userId, JSON.stringify(settings), updatedAt)
      .run();
    return json({ ok: true, updatedAt }, 200, cors);
  }

  if (path === '/sync/library' && request.method === 'GET') {
    const last = await env.DB.prepare('SELECT fingerprint FROM last_book WHERE user_id = ?')
      .bind(userId)
      .first<{ fingerprint: string }>();
    const books = await env.DB.prepare(
      `SELECT b.fingerprint, b.title, b.author, b.word_count, b.updated_at AS book_updated_at,
              p.word_index, p.word_count AS progress_word_count, p.wpm, p.finished, p.updated_at AS progress_updated_at
       FROM books b
       LEFT JOIN progress p ON p.user_id = b.user_id AND p.fingerprint = b.fingerprint
       WHERE b.user_id = ?
       ORDER BY COALESCE(p.updated_at, b.updated_at) DESC`,
    )
      .bind(userId)
      .all<{
        fingerprint: string;
        title: string;
        author: string | null;
        word_count: number;
        book_updated_at: number;
        word_index: number | null;
        progress_word_count: number | null;
        wpm: number | null;
        finished: number | null;
        progress_updated_at: number | null;
      }>();

    return json(
      {
        lastBookFingerprint: last?.fingerprint ?? null,
        books: books.results.map((row) => ({
          fingerprint: row.fingerprint,
          title: row.title,
          ...(row.author === null ? {} : { author: row.author }),
          wordCount: row.word_count,
          updatedAt: row.book_updated_at,
          progress:
            row.word_index === null || row.progress_word_count === null || row.wpm === null
              ? null
              : {
                  wordIndex: row.word_index,
                  wordCount: row.progress_word_count,
                  wpm: row.wpm,
                  finished: row.finished === 1,
                  updatedAt: row.progress_updated_at ?? row.book_updated_at,
                },
        })),
      },
      200,
      cors,
    );
  }

  if (path === '/sync/book-meta' && request.method === 'PUT') {
    const body = await readJson(request);
    const fingerprint = field(body, 'fingerprint');
    const fpErr = fingerprintError(fingerprint);
    if (fpErr !== undefined) return json({ error: fpErr }, 400, cors);
    const title = field(body, 'title').trim() || 'Untitled';
    const authorRaw = field(body, 'author').trim();
    const wordCount = numberField(body, 'wordCount') ?? 0;
    const updatedAt = numberField(body, 'updatedAt') ?? Date.now();
    await env.DB.prepare(
      `INSERT INTO books (user_id, fingerprint, title, author, word_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, fingerprint) DO UPDATE SET
         title = excluded.title,
         author = excluded.author,
         word_count = excluded.word_count,
         updated_at = excluded.updated_at`,
    )
      .bind(userId, fingerprint, title, authorRaw === '' ? null : authorRaw, wordCount, updatedAt)
      .run();
    return json({ ok: true }, 200, cors);
  }

  if (path === '/sync/progress' && request.method === 'PUT') {
    const body = await readJson(request);
    const fingerprint = field(body, 'fingerprint');
    const fpErr = fingerprintError(fingerprint);
    if (fpErr !== undefined) return json({ error: fpErr }, 400, cors);
    const wordIndex = numberField(body, 'wordIndex') ?? 0;
    const wordCount = numberField(body, 'wordCount') ?? 0;
    const wpm = numberField(body, 'wpm') ?? 300;
    const finished = body.finished === true;
    const updatedAt = numberField(body, 'updatedAt') ?? Date.now();
    const current = await env.DB.prepare(
      'SELECT updated_at FROM progress WHERE user_id = ? AND fingerprint = ?',
    )
      .bind(userId, fingerprint)
      .first<{ updated_at: number }>();
    if (current !== null && current.updated_at > updatedAt) {
      return json({ ignored: true, updatedAt: current.updated_at }, 200, cors);
    }
    await env.DB.prepare(
      `INSERT INTO progress (user_id, fingerprint, word_index, word_count, wpm, finished, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, fingerprint) DO UPDATE SET
         word_index = excluded.word_index,
         word_count = excluded.word_count,
         wpm = excluded.wpm,
         finished = excluded.finished,
         updated_at = excluded.updated_at`,
    )
      .bind(userId, fingerprint, wordIndex, wordCount, wpm, finished ? 1 : 0, updatedAt)
      .run();
    return json({ ok: true }, 200, cors);
  }

  if (path === '/sync/last-book' && request.method === 'PUT') {
    const body = await readJson(request);
    const fingerprint = field(body, 'fingerprint');
    const fpErr = fingerprintError(fingerprint);
    if (fpErr !== undefined) return json({ error: fpErr }, 400, cors);
    const updatedAt = numberField(body, 'updatedAt') ?? Date.now();
    await env.DB.prepare(
      `INSERT INTO last_book (user_id, fingerprint, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET fingerprint = excluded.fingerprint, updated_at = excluded.updated_at`,
    )
      .bind(userId, fingerprint, updatedAt)
      .run();
    return json({ ok: true }, 200, cors);
  }

  return json({ error: 'Not found.' }, 404, cors);
}
