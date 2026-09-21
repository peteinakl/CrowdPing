// Authenticated organiser surface (PRD §6/§9). The gateway (see supabase/config.toml,
// [functions.organiser-api] verify_jwt = true) already rejects requests with no valid JWT at
// all; every route here additionally relies on auth.uid() (via the forwarded JWT) inside RLS
// policies or the SECURITY DEFINER functions themselves for the real ownership check — never
// on a client-supplied owner id.
import { Hono } from 'hono';
import { loadEnv } from '../_shared/env.ts';
import { createForwardedJwtClient } from '../_shared/dbClients.ts';
import { assertAllowedOrigin, corsHeaders } from '../_shared/originCheck.ts';
import { ApiError, errorResponse, fromPostgresError, jsonResponse } from '../_shared/errors.ts';

const app = new Hono().basePath('/organiser-api');

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

// GET /organiser-api/polls?page=0&pageSize=20 — RLS-scoped, owner's polls only.
app.get('/polls', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const page = Math.max(0, Number(c.req.query('page') ?? '0') || 0);
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize') ?? '20') || 20));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('polls')
    .select('id, question, status, public_code, response_count, created_at, published_at, closed_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return jsonResponse({ polls: data, total: count ?? 0, page, pageSize }, {}, cors);
});

// POST /organiser-api/polls — create a draft.
app.post('/polls', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new ApiError('UNAUTHORISED', 'Sign in required');

  const allowed = await supabase.rpc('check_rate_limit', {
    p_key: `create:${userData.user.id}`,
    p_max: 10,
    p_window: '1 hour',
  });
  if (allowed.error) throw fromPostgresError(allowed.error.message);
  if (!allowed.data) throw new ApiError('RATE_LIMITED', 'Too many polls created recently. Please wait before creating another.');

  const body = await c.req.json<{
    question?: string;
    choices?: string[];
    participantResultsMode?: 'after_vote' | 'after_close';
    expiryDays?: number;
  }>().catch(() => ({}));

  if (!body.question || !Array.isArray(body.choices)) {
    throw new ApiError('VALIDATION_ERROR', 'question and choices are required');
  }

  const { data, error } = await supabase.rpc('create_draft_poll', {
    p_question: body.question,
    p_choices: body.choices,
    p_participant_results_mode: body.participantResultsMode ?? 'after_vote',
    p_expiry_days: body.expiryDays ?? 7,
  });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse({ id: data }, { status: 201 }, cors);
});

// GET /organiser-api/polls/:id — RLS-scoped, own poll + options embedded.
app.get('/polls/:id', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const { data, error } = await supabase
    .from('polls')
    .select('*, poll_options(id, label, position)')
    .eq('id', c.req.param('id'))
    .order('position', { referencedTable: 'poll_options', ascending: true })
    .maybeSingle();

  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  if (!data) throw new ApiError('POLL_NOT_FOUND', 'No such poll');
  return jsonResponse(data, {}, cors);
});

// PATCH /organiser-api/polls/:id — edit a draft.
app.patch('/polls/:id', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const body = await c.req.json<{
    question?: string;
    choices?: string[];
    participantResultsMode?: 'after_vote' | 'after_close';
    expiryDays?: number;
  }>().catch(() => ({}));

  if (!body.question || !Array.isArray(body.choices)) {
    throw new ApiError('VALIDATION_ERROR', 'question and choices are required');
  }

  const { error } = await supabase.rpc('update_draft_poll', {
    p_poll_id: c.req.param('id'),
    p_question: body.question,
    p_choices: body.choices,
    p_participant_results_mode: body.participantResultsMode ?? 'after_vote',
    p_expiry_days: body.expiryDays ?? 7,
  });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse({ updated: true }, {}, cors);
});

// DELETE /organiser-api/polls/:id — draft or closed only.
app.delete('/polls/:id', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const { error } = await supabase.rpc('delete_poll', { p_poll_id: c.req.param('id') });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse({ deleted: true }, {}, cors);
});

// POST /organiser-api/polls/:id/publish
app.post('/polls/:id/publish', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const { data, error } = await supabase.rpc('publish_poll', { p_poll_id: c.req.param('id') });
  if (error) throw fromPostgresError(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return jsonResponse({ publicCode: row.public_code, closesAt: row.closes_at }, {}, cors);
});

// POST /organiser-api/polls/:id/close
app.post('/polls/:id/close', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const { error } = await supabase.rpc('close_poll', { p_poll_id: c.req.param('id') });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse({ closed: true }, {}, cors);
});

// GET /organiser-api/polls/:id/results — full counts/percentages/total, owner-only.
app.get('/polls/:id/results', async (c) => {
  const env = loadEnv();
  const supabase = createForwardedJwtClient(env, c.req.raw);
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);

  const { data, error } = await supabase.rpc('get_owner_results', { p_poll_id: c.req.param('id') });
  if (error) throw fromPostgresError(error.message);
  return jsonResponse(data, {}, cors);
});

app.onError((err, c) => {
  const env = loadEnv();
  const cors = corsHeaders(c.req.raw, env.allowedOrigins);
  if (err instanceof ApiError) return errorResponse(err, cors);
  console.error('organiser-api unhandled error:', err);
  return errorResponse(new ApiError('INTERNAL_ERROR', 'Something went wrong. Please try again.'), cors);
});

Deno.serve(app.fetch);
