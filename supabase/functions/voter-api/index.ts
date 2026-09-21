// Anonymous voter surface (PRD §6/§9). Called with the anon apikey only — never a Supabase
// user JWT. All identity comes from the signed cp_voter cookie verified in this function.
import { Hono, type Context } from 'hono';
import { loadEnv } from '../_shared/env.ts';
import { createAnonClient } from '../_shared/dbClients.ts';
import { assertAllowedOrigin, corsHeaders } from '../_shared/originCheck.ts';
import { ApiError, errorResponse, fromPostgresError, jsonResponse } from '../_shared/errors.ts';
import {
  VOTER_COOKIE_NAME,
  parseCookieHeader,
  mintVoterCookie,
  verifyVoterCookie,
  deriveVoterKeyHash,
  buildSetCookieHeader,
  signSecret,
} from '../_shared/voterCookie.ts';

const RATE_LIMITS = {
  session: { max: 20, key: (ip: string) => `session:${ip}` },
  vote: { max: 10, key: (code: string, hash: string) => `vote:${code}:${hash}` },
  results: { max: 60, key: (code: string, hash: string) => `results:${code}:${hash}` },
  report: { max: 5, key: (ip: string) => `report:${ip}` },
} as const;

const app = new Hono().basePath('/voter-api');

app.use('*', async (c, next) => {
  const env = loadEnv();
  try {
    assertAllowedOrigin(c.req.raw, env.allowedOrigins);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err, corsHeaders(c.req.raw, env.allowedOrigins));
    throw err;
  }
  await next();
});

app.options('*', (c) => {
  const env = loadEnv();
  return new Response(null, { status: 204, headers: corsHeaders(c.req.raw, env.allowedOrigins) });
});

async function requireVoterKeyHash(c: Context, code: string): Promise<string | null> {
  const env = loadEnv();
  const cookieValue = parseCookieHeader(c.req.header('Cookie') ?? null, VOTER_COOKIE_NAME);
  if (!cookieValue) return null;
  const secret = await verifyVoterCookie(cookieValue, env.voterCookieSigningKeys);
  if (!secret) return null;
  return deriveVoterKeyHash(code, secret, env.voterKeyDerivationKey);
}

function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
}

// GET /voter-api/polls/:code — public poll content, no aggregates, no owner identity.
app.get('/polls/:code', async (c) => {
  const env = loadEnv();
  const supabase = createAnonClient(env);
  const { data, error } = await supabase.rpc('get_public_poll', { p_public_code: c.req.param('code') });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse(data, {}, corsHeaders(c.req.raw, env.allowedOrigins));
});

// POST /voter-api/polls/:code/session — establish/reuse the voter cookie. No vote mutation.
app.post('/polls/:code/session', async (c) => {
  const env = loadEnv();
  const supabase = createAnonClient(env);
  const code = c.req.param('code');
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const allowed = await supabase.rpc('check_rate_limit', {
    p_key: RATE_LIMITS.session.key(clientIp(c.req.raw)),
    p_max: RATE_LIMITS.session.max,
  });
  if (allowed.error) throw fromPostgresError(allowed.error.message);
  if (!allowed.data) throw new ApiError('RATE_LIMITED', 'Too many session requests. Try again shortly.');

  // Confirms the poll actually exists (typed 404 otherwise) before issuing a credential for it.
  const poll = await supabase.rpc('get_public_poll', { p_public_code: code });
  if (poll.error) throw fromPostgresError(poll.error.message);

  const existingCookie = parseCookieHeader(c.req.header('Cookie') ?? null, VOTER_COOKIE_NAME);
  let secret = existingCookie ? await verifyVoterCookie(existingCookie, env.voterCookieSigningKeys) : null;
  if (!secret) {
    ({ secret } = await mintVoterCookie(env.voterCookieSigningKeys));
  }
  // Re-signing the (possibly pre-existing) secret under the current key on every session call
  // transparently migrates cookies signed with a rotated-out key, and refreshes the 90-day
  // sliding expiry.
  const cookieValue = await signSecret(secret, env.voterCookieSigningKeys[0]);

  return jsonResponse(
    { established: true },
    { headers: { 'Set-Cookie': buildSetCookieHeader(cookieValue, env.cookieSecure) } },
    cors,
  );
});

// GET /voter-api/polls/:code/my-vote — only this credential's saved answer, or none.
app.get('/polls/:code/my-vote', async (c) => {
  const env = loadEnv();
  const supabase = createAnonClient(env);
  const code = c.req.param('code');
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const voterKeyHash = await requireVoterKeyHash(c, code);
  if (!voterKeyHash) return jsonResponse({ hasVote: false }, {}, cors);

  const { data, error } = await supabase.rpc('get_my_vote', { p_public_code: code, p_voter_key_hash: voterKeyHash });
  if (error) throw fromPostgresError(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return jsonResponse({ hasVote: false }, {}, cors);
  return jsonResponse({ hasVote: true, optionId: row.option_id, revision: row.revision }, {}, cors);
});

// PUT /voter-api/polls/:code/my-vote — submit or change a vote.
app.put('/polls/:code/my-vote', async (c) => {
  const env = loadEnv();
  const supabase = createAnonClient(env);
  const code = c.req.param('code');
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const body = await c.req.json<{ optionId?: string; expectedRevision?: number }>().catch(() => ({}));
  if (!body.optionId || typeof body.expectedRevision !== 'number') {
    throw new ApiError('VALIDATION_ERROR', 'optionId and expectedRevision are required');
  }

  const voterKeyHash = await requireVoterKeyHash(c, code);
  if (!voterKeyHash) {
    // Never silently mint a credential here: if the client's cookie didn't round-trip (e.g.
    // cookies are blocked), minting one now would let every vote attempt look like a brand
    // new voter and be accepted forever (PRD §10 explicitly forbids this). The client must
    // call POST /polls/:code/session first and confirm the cookie actually came back.
    throw new ApiError('NO_SESSION', 'No voter session found. Establish a session before voting.');
  }

  const allowed = await supabase.rpc('check_rate_limit', {
    p_key: RATE_LIMITS.vote.key(code, voterKeyHash),
    p_max: RATE_LIMITS.vote.max,
  });
  if (allowed.error) throw fromPostgresError(allowed.error.message);
  if (!allowed.data) throw new ApiError('RATE_LIMITED', 'Too many vote attempts. Please slow down.');

  const { data, error } = await supabase.rpc('submit_vote', {
    p_public_code: code,
    p_voter_key_hash: voterKeyHash,
    p_option_id: body.optionId,
    p_expected_revision: body.expectedRevision,
  });
  if (error) throw fromPostgresError(error.message);
  const row = Array.isArray(data) ? data[0] : data;

  return jsonResponse(
    { status: row.status, optionId: row.option_id, revision: row.revision },
    {},
    cors,
  );
});

// GET /voter-api/polls/:code/results — eligibility enforced inside get_participant_results.
app.get('/polls/:code/results', async (c) => {
  const env = loadEnv();
  const supabase = createAnonClient(env);
  const code = c.req.param('code');
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const voterKeyHash = await requireVoterKeyHash(c, code);
  if (!voterKeyHash) throw new ApiError('UNAUTHORISED', 'No recorded vote for this browser');

  const allowed = await supabase.rpc('check_rate_limit', {
    p_key: RATE_LIMITS.results.key(code, voterKeyHash),
    p_max: RATE_LIMITS.results.max,
  });
  if (allowed.error) throw fromPostgresError(allowed.error.message);
  if (!allowed.data) throw new ApiError('RATE_LIMITED', 'Too many results requests. Please slow down.');

  const { data, error } = await supabase.rpc('get_participant_results', {
    p_public_code: code,
    p_voter_key_hash: voterKeyHash,
  });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse(data, {}, cors);
});

// POST /voter-api/polls/:code/report — abuse reporting, open to any link holder.
app.post('/polls/:code/report', async (c) => {
  const env = loadEnv();
  const supabase = createAnonClient(env);
  const code = c.req.param('code');
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const allowed = await supabase.rpc('check_rate_limit', {
    p_key: RATE_LIMITS.report.key(clientIp(c.req.raw)),
    p_max: RATE_LIMITS.report.max,
  });
  if (allowed.error) throw fromPostgresError(allowed.error.message);
  if (!allowed.data) throw new ApiError('RATE_LIMITED', 'Too many reports. Please try again later.');

  const body = await c.req.json<{ note?: string }>().catch(() => ({}));
  const { error } = await supabase.rpc('report_poll', { p_public_code: code, p_reporter_note: body.note ?? null });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse({ reported: true }, {}, cors);
});

app.onError((err, c) => {
  const env = loadEnv();
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);
  if (err instanceof ApiError) return errorResponse(err, cors);
  console.error('voter-api unhandled error:', err);
  return errorResponse(new ApiError('INTERNAL_ERROR', 'Something went wrong. Please try again.'), cors);
});

Deno.serve(app.fetch);
