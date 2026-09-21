-- A4/A5: the submit_vote state machine — first vote, idempotent re-selection, a valid
-- change, a stale conflict, a foreign option, and rejection once closed. Also checks that
-- changing an answer never changes response_count (PRD §10.7).
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- votes.voter_key_hash is constrained to a real 64-char hex digest shape; use sha256 hashes
-- of fixture labels rather than short literal strings.
select encode(extensions.digest('hash1', 'sha256'), 'hex') as hash1 \gset
select encode(extensions.digest('hash2', 'sha256'), 'hex') as hash2 \gset
select encode(extensions.digest('hash3', 'sha256'), 'hex') as hash3 \gset

select gen_random_uuid() as owner_id \gset
insert into auth.users (id, email) values (:'owner_id', 'owner4@example.test');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select create_draft_poll('Vote on this?', array['A', 'B']) as poll_id \gset
select public_code from publish_poll(:'poll_id') \gset

select id as option_a from public.poll_options where poll_id = :'poll_id' and label = 'A' \gset
select id as option_b from public.poll_options where poll_id = :'poll_id' and label = 'B' \gset

-- A second, unrelated poll purely to get a genuinely foreign option id.
select create_draft_poll('Other poll?', array['X', 'Y']) as other_poll_id \gset
select id as foreign_option from public.poll_options where poll_id = :'other_poll_id' limit 1 \gset

-- voter-api calls these via a service-role client, not anon (see
-- lock_down_voter_rpc_and_internal_tables/lock_down_internal_helpers_and_default_grants:
-- anon/authenticated EXECUTE on submit_vote et al. is revoked so PostgREST can't be used to
-- bypass the cookie-derived voter_key_hash). service_role is what actually calls this in
-- production, so that's what the test simulates too.
reset role;
set local role service_role;

select is(
  (select status from submit_vote(:'public_code', :'hash1', :'option_a', 0)),
  'saved',
  'first vote for hash1 is saved'
);
select is(
  (select status from submit_vote(:'public_code', :'hash1', :'option_a', 0)),
  'no_op',
  'reselecting the same option is a successful no-op regardless of expected_revision'
);
select is(
  (select revision from submit_vote(:'public_code', :'hash1', :'option_b', 1)),
  2,
  'changing A to B with the correct expected_revision saves as revision 2'
);
select is(
  (select status from submit_vote(:'public_code', :'hash1', :'option_a', 1)),
  'conflict',
  'a stale expected_revision on a genuine change is reported as a conflict'
);
select is(
  (select option_id from submit_vote(:'public_code', :'hash1', :'option_a', 1)),
  :'option_b'::uuid,
  'the conflict response returns the current saved option, not the rejected one'
);
select is(
  (select status from submit_vote(:'public_code', :'hash2', :'option_a', 0)),
  'saved',
  'a second, independent voter can vote for A'
);
select throws_ok(
  format($$ select * from submit_vote('%s', '%s', '%s', 2) $$, :'public_code', :'hash1', :'foreign_option'),
  'INVALID_OPTION: option does not belong to this poll',
  'voting for another poll''s option id is rejected'
);

-- response_count is a private/owner-visible detail, not selectable as anon.
reset role;
select is(
  (select response_count from public.polls where id = :'poll_id'),
  2,
  'response_count is 2 (two distinct voters) even though hash1 changed their answer once'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select close_poll(:'poll_id');
reset role;

set local role service_role;
select throws_ok(
  format($$ select * from submit_vote('%s', '%s', '%s', 0) $$, :'public_code', :'hash3', :'option_a'),
  'POLL_CLOSED: voting has closed',
  'voting on a closed poll is rejected'
);
reset role;

select * from finish();
rollback;
