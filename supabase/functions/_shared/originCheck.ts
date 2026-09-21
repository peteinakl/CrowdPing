// PRD §6: "Validate mutation origins against configured frontend origins in Supabase,
// including on direct upstream requests. Do not rely on CORS or the Cloudflare proxy as the
// only authorisation boundary." Applied on every request, not just mutations — an Origin
// header that IS present must match; a request that sends none (e.g. a plain curl/health
// check, or some simple same-origin GETs) is not rejected on that basis alone, since this
// check cannot validate what the client never sent.

import { ApiError } from './errors.ts';

export function assertAllowedOrigin(req: Request, allowedOrigins: string[]): void {
  const origin = req.headers.get('Origin');
  if (origin && !allowedOrigins.includes(origin)) {
    throw new ApiError('ORIGIN_FORBIDDEN', 'Request origin is not permitted');
  }
}

export function corsHeaders(req: Request, allowedOrigins: string[]): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      Vary: 'Origin',
    };
  }
  return {};
}
