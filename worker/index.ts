import { handleAuth } from './auth';
import { corsHeaders, json, type Env } from './http';
import { handleSync } from './sync';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (env.JWT_SECRET === undefined || env.JWT_SECRET.length === 0) {
      return json({ error: 'This API is missing JWT_SECRET.' }, 503, cors);
    }

    const path = new URL(request.url).pathname;

    if (path === '/health' && request.method === 'GET') {
      return json({ ok: true }, 200, cors);
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
