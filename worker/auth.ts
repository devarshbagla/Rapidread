import { emailError, normalizeEmail, normalizeUsername, passwordError, usernameError } from '../src/auth/rules';
import { hashPassword, newId, passwordsMatch, randomToken, sha256Hex, signJwt, verifyJwt } from '../src/auth/crypto';
import { sendMail } from './email';
import { json, type Env } from './http';
import { clientKey, rateLimit } from './rateLimit';

interface UserRow {
  id: string;
  username: string;
  username_normalized: string;
  password_hash: string;
  password_salt: string;
  email: string | null;
  email_verified_at: number | null;
  created_at: number;
}

function publicUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    emailVerified: row.email_verified_at !== null,
    createdAt: row.created_at,
  };
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  return {};
}

function field(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  return typeof value === 'string' ? value : '';
}

async function loadUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

async function loadUserByName(db: D1Database, username: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT * FROM users WHERE username_normalized = ?')
    .bind(normalizeUsername(username))
    .first<UserRow>();
}

async function requireUser(
  request: Request,
  env: Env,
  cors: Headers,
): Promise<{ user: UserRow } | Response> {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') === true ? header.slice(7) : undefined;
  if (token === undefined || env.JWT_SECRET === undefined || env.JWT_SECRET.length === 0) {
    return json({ error: 'Sign in to continue.' }, 401, cors);
  }
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (payload === undefined) return json({ error: 'Sign in to continue.' }, 401, cors);
  const user = await loadUserById(env.DB, payload.sub);
  if (user === null) return json({ error: 'Sign in to continue.' }, 401, cors);
  return { user };
}

function appOrigin(env: Env): string {
  return (env.APP_ORIGIN ?? 'https://devarshbagla.github.io/Rapidread').replace(/\/$/, '');
}

async function issueToken(
  db: D1Database,
  userId: string,
  purpose: 'email' | 'reset',
  ttlMs: number,
): Promise<string> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await db
    .prepare(
      'INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)',
    )
    .bind(newId(), userId, purpose, tokenHash, Date.now() + ttlMs)
    .run();
  return token;
}

async function consumeToken(
  db: D1Database,
  token: string,
  purpose: 'email' | 'reset',
): Promise<string | undefined> {
  const tokenHash = await sha256Hex(token);
  const row = await db
    .prepare(
      'SELECT id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ? AND purpose = ?',
    )
    .bind(tokenHash, purpose)
    .first<{ id: string; user_id: string; expires_at: number; used_at: number | null }>();
  if (row === null || row.used_at !== null || row.expires_at < Date.now()) return undefined;
  await db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').bind(Date.now(), row.id).run();
  return row.user_id;
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

async function sendVerifyEmail(env: Env, email: string, token: string): Promise<boolean> {
  const link = `${appOrigin(env)}/#verify=${encodeURIComponent(token)}`;
  return sendMail(
    env,
    email,
    'Confirm your Rapidread email',
    `Confirm this email for Rapidread:\n\n${link}\n\nIf you did not add this address, ignore this message.`,
  );
}

async function sendResetEmail(env: Env, email: string, token: string): Promise<boolean> {
  const link = `${appOrigin(env)}/#reset=${encodeURIComponent(token)}`;
  return sendMail(
    env,
    email,
    'Reset your Rapidread password',
    `Reset your Rapidread password:\n\n${link}\n\nThis link expires in one hour. If you did not ask for it, ignore this message.`,
  );
}

export async function handleAuth(
  request: Request,
  env: Env,
  path: string,
  cors: Headers,
): Promise<Response | undefined> {
  if (path === '/auth/register' && request.method === 'POST') {
    if (!(await rateLimit(env.DB, clientKey(request, 'register'), 10))) {
      return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429, cors);
    }
    const body = await readJson(request);
    const username = field(body, 'username');
    const password = field(body, 'password');
    const emailRaw = field(body, 'email');
    const nameErr = usernameError(username);
    if (nameErr !== undefined) return json({ error: nameErr }, 400, cors);
    const passErr = passwordError(password);
    if (passErr !== undefined) return json({ error: passErr }, 400, cors);
    const mailErr = emailError(emailRaw);
    if (mailErr !== undefined) return json({ error: mailErr }, 400, cors);

    const existing = await loadUserByName(env.DB, username);
    if (existing !== null) return json({ error: 'That username is already taken.' }, 409, cors);

    const email = emailRaw.trim() === '' ? null : normalizeEmail(emailRaw);
    if (email !== null) {
      const taken = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (taken !== null) return json({ error: 'That email is already in use.' }, 409, cors);
    }

    const { hash, salt } = await hashPassword(password);
    const id = newId();
    const createdAt = Date.now();
    const displayName = username.trim();
    try {
      await env.DB.prepare(
        `INSERT INTO users (id, username, username_normalized, password_hash, password_salt, email, email_verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
        .bind(id, displayName, normalizeUsername(username), hash, salt, email, createdAt)
        .run();
    } catch {
      return json({ error: 'That username is already taken.' }, 409, cors);
    }

    if (email !== null) {
      const token = await issueToken(env.DB, id, 'email', VERIFY_TTL_MS);
      await sendVerifyEmail(env, email, token);
    }

    const token = await signJwt(id, displayName, env.JWT_SECRET ?? '');
    return json(
      {
        token,
        user: publicUser({
          id,
          username: displayName,
          username_normalized: normalizeUsername(username),
          password_hash: hash,
          password_salt: salt,
          email,
          email_verified_at: null,
          created_at: createdAt,
        }),
      },
      201,
      cors,
    );
  }

  if (path === '/auth/login' && request.method === 'POST') {
    if (!(await rateLimit(env.DB, clientKey(request, 'login'), 20))) {
      return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429, cors);
    }
    const body = await readJson(request);
    const username = field(body, 'username');
    const password = field(body, 'password');
    const user = await loadUserByName(env.DB, username);
    const ok = user !== null && (await passwordsMatch(password, user.password_salt, user.password_hash));
    if (!ok || user === null) {
      return json(
        {
          error: 'Username or password is wrong.',
          hint: 'Forgot your password? A verified email is the only way to reset it.',
        },
        401,
        cors,
      );
    }
    const token = await signJwt(user.id, user.username, env.JWT_SECRET ?? '');
    return json({ token, user: publicUser(user) }, 200, cors);
  }

  if (path === '/auth/me' && request.method === 'GET') {
    const authed = await requireUser(request, env, cors);
    if (authed instanceof Response) return authed;
    return json({ user: publicUser(authed.user) }, 200, cors);
  }

  if (path === '/auth/email' && request.method === 'POST') {
    const authed = await requireUser(request, env, cors);
    if (authed instanceof Response) return authed;
    const body = await readJson(request);
    const emailRaw = field(body, 'email');
    const mailErr = emailError(emailRaw);
    if (mailErr !== undefined) return json({ error: mailErr }, 400, cors);
    if (emailRaw.trim() === '') return json({ error: 'Enter an email address.' }, 400, cors);
    const email = normalizeEmail(emailRaw);
    const taken = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .bind(email, authed.user.id)
      .first();
    if (taken !== null) return json({ error: 'That email is already in use.' }, 409, cors);
    await env.DB.prepare('UPDATE users SET email = ?, email_verified_at = NULL WHERE id = ?')
      .bind(email, authed.user.id)
      .run();
    const token = await issueToken(env.DB, authed.user.id, 'email', VERIFY_TTL_MS);
    const sent = await sendVerifyEmail(env, email, token);
    const user = await loadUserById(env.DB, authed.user.id);
    return json(
      {
        user: user === null ? publicUser({ ...authed.user, email, email_verified_at: null }) : publicUser(user),
        sent,
        message: sent
          ? 'Check that inbox for a confirmation link.'
          : 'Email sending is not configured on the server yet. The address is saved, but you cannot verify it until mail is set up.',
      },
      200,
      cors,
    );
  }

  if (path === '/auth/email/verify' && request.method === 'POST') {
    const body = await readJson(request);
    const token = field(body, 'token');
    const userId = await consumeToken(env.DB, token, 'email');
    if (userId === undefined) return json({ error: 'This confirmation link is invalid or has expired.' }, 400, cors);
    await env.DB.prepare('UPDATE users SET email_verified_at = ? WHERE id = ? AND email IS NOT NULL')
      .bind(Date.now(), userId)
      .run();
    const user = await loadUserById(env.DB, userId);
    if (user === null) return json({ error: 'This confirmation link is invalid or has expired.' }, 400, cors);
    const jwt = await signJwt(user.id, user.username, env.JWT_SECRET ?? '');
    return json({ token: jwt, user: publicUser(user) }, 200, cors);
  }

  if (path === '/auth/forgot' && request.method === 'POST') {
    if (!(await rateLimit(env.DB, clientKey(request, 'forgot'), 8))) {
      return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429, cors);
    }
    const body = await readJson(request);
    const username = field(body, 'username');
    const user = username.trim() === '' ? null : await loadUserByName(env.DB, username);

    if (user !== null && user.email !== null && user.email_verified_at !== null) {
      const token = await issueToken(env.DB, user.id, 'reset', RESET_TTL_MS);
      await sendResetEmail(env, user.email, token);
      return json(
        {
          ok: true,
          recovery: 'email',
          message: 'If this account has a verified email, we sent a reset link.',
        },
        200,
        cors,
      );
    }

    if (user !== null) {
      return json(
        {
          ok: true,
          recovery: 'none',
          message:
            'This account has no recovery email. Sign in and add one in Settings, or you will not be able to reset the password.',
        },
        200,
        cors,
      );
    }

    return json(
      {
        ok: true,
        recovery: 'unknown',
        message: 'If this account has a verified email, we sent a reset link.',
      },
      200,
      cors,
    );
  }

  if (path === '/auth/reset' && request.method === 'POST') {
    const body = await readJson(request);
    const token = field(body, 'token');
    const password = field(body, 'password');
    const passErr = passwordError(password);
    if (passErr !== undefined) return json({ error: passErr }, 400, cors);
    const userId = await consumeToken(env.DB, token, 'reset');
    if (userId === undefined) return json({ error: 'This reset link is invalid or has expired.' }, 400, cors);
    const { hash, salt } = await hashPassword(password);
    await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
      .bind(hash, salt, userId)
      .run();
    const user = await loadUserById(env.DB, userId);
    if (user === null) return json({ error: 'This reset link is invalid or has expired.' }, 400, cors);
    const jwt = await signJwt(user.id, user.username, env.JWT_SECRET ?? '');
    return json({ token: jwt, user: publicUser(user) }, 200, cors);
  }

  return undefined;
}

export { requireUser, publicUser, type UserRow };
