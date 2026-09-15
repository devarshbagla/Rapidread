import { handleAuth } from './auth';
import { corsHeaders, json, type Env } from './http';
import { handleSync } from './sync';

function isApiPath(path: string): boolean {
  return path === '/health' || path.startsWith('/auth/') || path.startsWith('/sync/');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    const cors = corsHeaders(request, env);

    if (!isApiPath(path)) {
      if (env.ASSETS !== undefined) return env.ASSETS.fetch(request);
      return json({ error: 'Not found.' }, 404, cors);
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (path === '/health' && request.method === 'GET') {
      return json(
        {
          ok: true,
          accounts: env.JWT_SECRET !== undefined && env.JWT_SECRET.length > 0,
        },
        200,
        cors,
      );
    }

    if (env.JWT_SECRET === undefined || env.JWT_SECRET.length === 0) {
      return json({ error: 'Accounts are not configured on the server yet.' }, 503, cors);
    }

    try {
      const auth = await handleAuth(request, env, path, cors);
      if (auth !== undefined) return auth;
      const sync = await handleSync(request, env, path, cors);
      if (sync !== undefined) return sync;
      return json({ error: 'Not found.' }, 404, cors);
    } catch (error) {
      console.error(error);
      return json({ error: 'Something went wrong.' }, 500, cors);
    }
  },
} satisfies { fetch: (request: Request, env: Env) => Promise<Response> };
