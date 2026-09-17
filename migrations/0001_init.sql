CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  username_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  email TEXT UNIQUE,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX auth_tokens_user_purpose ON auth_tokens (user_id, purpose);

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE books (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  word_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, fingerprint)
);

CREATE TABLE progress (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  word_index INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  wpm INTEGER NOT NULL,
  finished INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, fingerprint)
);

CREATE TABLE last_book (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
