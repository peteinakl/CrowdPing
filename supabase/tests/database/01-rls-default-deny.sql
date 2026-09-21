-- Default-deny posture: anon/authenticated have no direct table access to votes, and only
-- owner-scoped SELECT on polls/poll_options (PRD §8, A1).
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- Fixture: two organiser users and one poll owned by user2.
select gen_random_uuid() as user1_id \gset
select gen_random_uuid() as user2_id \gset
insert into auth.users (id, email) values
  (:'user1_id', 'user1@example.test'),
  (:'user2_id', 'user2@example.test');

insert into public.polls (id, owner_id, question, status)
values ('11111111-1111-1111-1111-111111111111', :'user2_id', 'Owned by user2?', 'draft');

-- anon has zero grants on all three tables: any direct select must fail outright.
set local role anon;
select throws_ok(
  $$ select 1 from public.polls $$,
  'permission denied for table polls',
  'anon cannot select polls directly (no grant)'
);
select throws_ok(
  $$ select 1 from public.poll_options $$,
  'permission denied for table poll_options',
  'anon cannot select poll_options directly (no grant)'
);
select throws_ok(
  $$ select 1 from public.votes $$,
  'permission denied for table votes',
  'anon cannot select votes directly (no grant)'
);
reset role;

-- authenticated has a SELECT grant, but RLS must still hide rows that are not theirs.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'user1_id', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.polls where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'authenticated user1 cannot see a poll owned by user2 (RLS filters it out)'
);
select throws_ok(
  $$ select 1 from public.votes $$,
  'permission denied for table votes',
  'authenticated cannot select votes directly (no grant) even with a valid JWT'
);
reset role;

-- Owner can see their own poll via RLS.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'user2_id', 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from public.polls where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'authenticated user2 (the owner) can see their own poll via RLS'
);
reset role;

select * from finish();
rollback;
