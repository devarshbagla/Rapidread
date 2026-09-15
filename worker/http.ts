export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  APP_ORIGIN?: string;
  CORS_ORIGINS?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  ASSETS?: Fetcher;
}

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://devarshbagla.github.io',
];

export function allowedOrigins(env: Env, request: Request): string[] {
  const extra =
    env.CORS_ORIGINS === undefined || env.CORS_ORIGINS.trim() === ''
      ? []
      : env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  return [
    ...new Set(
      [...DEFAULT_ORIGINS, ...extra, env.APP_ORIGIN ?? '', selfOrigin(request)].filter(
        (origin) => origin.length > 0,
      ),
    ),
  ];
}

function selfOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

export function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin = request.headers.get('Origin');
  const allowed = allowedOrigins(env, request);
  if (origin !== null && allowed.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export function json(body: unknown, status: number, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}
