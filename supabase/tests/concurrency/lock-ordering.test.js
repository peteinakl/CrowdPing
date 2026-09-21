// Demonstrates PRD §10's "closing and voting acquire the same poll lock so their order is
// deterministic" with two REAL concurrent Postgres connections — not a single-threaded
// simulation like pgTAP is limited to. Plain JS (not TS) deliberately: this is a standalone,
// non-workspace verification script, so skipping a TS build step keeps it a zero-install
// (bar `npm install` in this directory) `node lock-ordering.test.js`.
//
// Usage: cd supabase/tests/concurrency && npm install && npm test
// Requires the local Supabase stack running (`supabase start`).

import pg from 'pg';
import { randomUUID, createHash } from 'node:crypto';

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok - ${message}`);
}

async function setUp(client, ownerId) {
  await client.query('insert into auth.users (id, email) values ($1, $2)', [ownerId, `${ownerId}@example.test`]);
  await client.query(
    `select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, false)`,
    [ownerId],
  );
  const { rows: [{ create_draft_poll: pollId }] } = await client.query(
    `select create_draft_poll($1, $2::text[])`,
    ['Lock ordering test poll', ['A', 'B']],
  );
  const { rows: [{ public_code: code }] } = await client.query(`select public_code from publish_poll($1)`, [pollId]);
  const { rows: options } = await client.query(`select id, label from public.poll_options where poll_id = $1 order by position`, [pollId]);
  return { pollId, code, optionA: options[0].id };
}

async function voteWinsRace() {
  console.log('\nScenario 1: submit_vote acquires the lock first (holds it, then close_poll blocks and runs after).');
  const setupClient = new pg.Client({ connectionString: DB_URL });
  await setupClient.connect();
  const ownerId = randomUUID();
  const { pollId, code, optionA } = await setUp(setupClient, ownerId);
  const voterHash = sha256Hex('concurrency-voter-1');

  const voteClient = new pg.Client({ connectionString: DB_URL });
  const closeClient = new pg.Client({ connectionString: DB_URL });
  await voteClient.connect();
  await closeClient.connect();

  await voteClient.query('begin');
  // Pre-acquire the same row lock submit_vote() takes internally, then hold it — Postgres row
  // locks are re-entrant within one transaction, so submit_vote's own internal FOR UPDATE
  // does not block against this same session's lock.
  await voteClient.query('select id from public.polls where public_code = $1 for update', [code]);
  const holdAndVote = (async () => {
    await voteClient.query('select pg_sleep(1)');
    const res = await voteClient.query('select * from submit_vote($1, $2, $3, 0)', [code, voterHash, optionA]);
    await voteClient.query('commit');
    return res.rows[0];
  })();

  await new Promise((resolve) => setTimeout(resolve, 200)); // let voteClient acquire the lock first
  await closeClient.query(
    `select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, false)`,
    [ownerId],
  );
  const closeStarted = Date.now();
  await closeClient.query('select close_poll($1)', [pollId]);
  const closeWaitedMs = Date.now() - closeStarted;

  const voteResult = await holdAndVote;

  assert(voteResult.status === 'saved', `vote result status is 'saved' (got ${voteResult.status})`);
  assert(closeWaitedMs >= 600, `close_poll actually blocked on the lock (waited ${closeWaitedMs}ms, expected >= ~600ms)`);

  const { rows: [{ count }] } = await setupClient.query('select count(*)::int from public.votes where poll_id = $1', [pollId]);
  assert(count === 1, `exactly one vote row exists (got ${count})`);
  const { rows: [{ status, response_count }] } = await setupClient.query(
    'select status::text, response_count from public.polls where id = $1',
    [pollId],
  );
  assert(status === 'closed', `poll ended up closed (got ${status})`);
  assert(response_count === 1, `response_count reflects the vote that landed before closure (got ${response_count})`);

  await voteClient.end();
  await closeClient.end();
  await setupClient.end();
}

async function closeWinsRace() {
  console.log('\nScenario 2: close_poll acquires the lock first (holds it, then submit_vote blocks and correctly rejects after).');
  const setupClient = new pg.Client({ connectionString: DB_URL });
  await setupClient.connect();
  const ownerId = randomUUID();
  const { pollId, code, optionA } = await setUp(setupClient, ownerId);
  const voterHash = sha256Hex('concurrency-voter-2');

  const voteClient = new pg.Client({ connectionString: DB_URL });
  const closeClient = new pg.Client({ connectionString: DB_URL });
  await voteClient.connect();
  await closeClient.connect();

  await closeClient.query(
    `select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, false)`,
    [ownerId],
  );
  await closeClient.query('begin');
  await closeClient.query('select id from public.polls where public_code = $1 for update', [code]);
  const holdAndClose = (async () => {
    await closeClient.query('select pg_sleep(1)');
    await closeClient.query('select close_poll($1)', [pollId]);
    await closeClient.query('commit');
  })();

  await new Promise((resolve) => setTimeout(resolve, 200));
  const voteStarted = Date.now();
  let voteError = null;
  try {
    await voteClient.query('select * from submit_vote($1, $2, $3, 0)', [code, voterHash, optionA]);
  } catch (err) {
    voteError = err;
  }
  const voteWaitedMs = Date.now() - voteStarted;

  await holdAndClose;

  assert(voteWaitedMs >= 600, `submit_vote actually blocked on the lock (waited ${voteWaitedMs}ms, expected >= ~600ms)`);
  assert(voteError !== null, 'submit_vote raised an error once it proceeded');
  assert(
    /POLL_CLOSED/.test(voteError?.message ?? ''),
    `the error is POLL_CLOSED, not something else (got: ${voteError?.message})`,
  );

  const { rows: [{ count }] } = await setupClient.query('select count(*)::int from public.votes where poll_id = $1', [pollId]);
  assert(count === 0, `no vote was recorded (got ${count})`);

  await voteClient.end();
  await closeClient.end();
  await setupClient.end();
}

async function main() {
  await voteWinsRace();
  await closeWinsRace();
  console.log('\nAll concurrency assertions passed.');
}

main().catch((err) => {
  console.error('\nConcurrency test FAILED:', err);
  process.exit(1);
});
