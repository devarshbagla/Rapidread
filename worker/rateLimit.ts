const WINDOW_MS = 15 * 60 * 1000;

export async function rateLimit(
  db: D1Database,
  key: string,
  max: number,
): Promise<boolean> {
  const now = Date.now();
  const row = await db
    .prepare('SELECT window_start, count FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ window_start: number; count: number }>();

  if (row === null || now - row.window_start >= WINDOW_MS) {
    await db
      .prepare('INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)')
      .bind(key, now)
      .run();
    return true;
  }

  if (row.count >= max) return false;
  await db
    .prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?')
    .bind(key)
    .run();
  return true;
}

export function clientKey(request: Request, bucket: string): string {
  const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('x-forwarded-for') ?? 'local';
  return `${bucket}:${ip}`;
}
