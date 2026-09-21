-- A1: owner A cannot read/change owner B's drafts, private results or management data
-- through any exposed write path (the SECURITY DEFINER functions themselves, not just RLS).
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select gen_random_uuid() as owner_id \gset
select gen_random_uuid() as intruder_id \gset
insert into auth.users (id, email) values
  (:'owner_id', 'owner@example.test'),
  (:'intruder_id', 'intruder@example.test');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select create_draft_poll('Owner''s question?', array['Yes', 'No']) as poll_id \gset

-- Switch to the intruder for every mutating/reading function.
select set_config('request.jwt.claims', json_build_object('sub', :'intruder_id', 'role', 'authenticated')::text, true);

select throws_ok(
  format($$ select update_draft_poll('%s', 'Hijacked?', array['A','B']) $$, :'poll_id'),
  'UNAUTHORISED: not the poll owner',
  'intruder cannot update owner''s draft'
);
select throws_ok(
  format($$ select publish_poll('%s') $$, :'poll_id'),
  'UNAUTHORISED: not the poll owner',
  'intruder cannot publish owner''s poll'
);
select throws_ok(
  format($$ select get_owner_results('%s') $$, :'poll_id'),
  'UNAUTHORISED: not the poll owner',
  'intruder cannot read owner''s private results'
);
select throws_ok(
  format($$ select close_poll('%s') $$, :'poll_id'),
  'UNAUTHORISED: not the poll owner',
  'intruder cannot close owner''s poll'
);
select throws_ok(
  format($$ select delete_poll('%s') $$, :'poll_id'),
  'UNAUTHORISED: not the poll owner',
  'intruder cannot delete owner''s poll'
);

-- The real owner can still edit their own draft.
select set_config('request.jwt.claims', json_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select lives_ok(
  format($$ select update_draft_poll('%s', 'Owner''s revised question?', array['Yes','No','Maybe']) $$, :'poll_id'),
  'the real owner can edit their own draft'
);

reset role;
select * from finish();
rollback;
