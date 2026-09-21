// Cloudflare Pages Functions catch-all proxy for /api/*.
//
// Thin, fixed-upstream transport only: no poll business logic lives here.
// Rewrites browser-facing /api/* routes onto the Supabase Edge Function
// upstream, forwards the first-party voter cookie / auth / content headers,
// and returns the upstream Set-Cookie verbatim so the voter credential stays
// first-party and HttpOnly. See CrowdPing_Product_Requirements.md §6.

interface Env {
  SUPABASE_FUNCTIONS_BASE_URL: string;
  ALLOWED_APP_ORIGINS: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const MAX_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
const FORWARDED_REQUEST_HEADERS = ['cookie', 'content-type', 'origin', 'authorization'];

function jsonError(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/**
 * Fixed, deterministic route table. Anything not matched here is a typed 404 —
 * this function must never fall back to serving SPA HTML for /api/*.
 */
function resolveUpstream(pathname: string, functionsBaseUrl: string): string | null {
  const base = functionsBaseUrl.replace(/\/+$/, '');

  if (pathname === '/api/organiser/polls' || pathname.startsWith('/api/organiser/polls/')) {
    const remainder = pathname.slice('/api/organiser'.length);
    return `${base}/organiser-api${remainder}`;
  }

  if (pathname === '/api/polls' || pathname.startsWith('/api/polls/')) {
    const remainder = pathname.slice('/api'.length);
    return `${base}/voter-api${remainder}`;
  }

  return null;
}

export const onRequest = async ({ request, env }: RequestContext): Promise<Response> => {
  const start = Date.now();
  const url = new URL(request.url);

  const upstreamPath = resolveUpstream(url.pathname, env.SUPABASE_FUNCTIONS_BASE_URL);
  if (!upstreamPath) {
    return jsonError('NOT_FOUND', 'Unknown API route.', 404);
  }

  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) {
    return jsonError('PAYLOAD_TOO_LARGE', 'Request body is too large.', 413);
  }

  const forwardedHeaders = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) forwardedHeaders.set(name, value);
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return jsonError('PAYLOAD_TOO_LARGE', 'Request body is too large.', 413);
    }
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamPath + url.search, {
      method: request.method,
      headers: forwardedHeaders,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Never log headers/body/cookies — method, path, and outcome only.
    console.log(`api-proxy ${request.method} ${url.pathname} -> upstream_error ${Date.now() - start}ms`);
    return jsonError('UPSTREAM_UNAVAILABLE', 'The service is temporarily unavailable. Please try again.', 502);
  }

  const responseHeaders = new Headers();
  const contentType = upstreamResponse.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  const setCookies =
    typeof upstreamResponse.headers.getSetCookie === 'function' ? upstreamResponse.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    responseHeaders.append('set-cookie', cookie);
  }

  // Every /api/* response is personalised or privacy-sensitive enough that
  // caching it anywhere (browser or CDN) is never correct.
  responseHeaders.set('cache-control', 'no-store');

  console.log(`api-proxy ${request.method} ${url.pathname} -> ${upstreamResponse.status} ${Date.now() - start}ms`);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
};
