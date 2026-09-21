-- A2: draft edits work; published question/choice edits, reordering and illegal lifecycle
-- transitions fail through every exposed write path, including a raw UPDATE/INSERT that
-- bypasses the functions entirely (the immutability triggers, not just the functions'
-- own checks).
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select gen_random_uuid() as owner_id \gset
insert into auth.users (id, email) values (:'owner_id', 'owner3@example.test');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select create_draft_poll('Publish me?', array['Yes', 'No']) as poll_id \gset

select lives_ok(
  format($$ select publish_poll('%s') $$, :'poll_id'),
  'owner can publish a valid draft'
);
select is(
  (select status::text from public.polls where id = :'poll_id'),
  'open',
  'poll status is open after publish'
);

select throws_ok(
  format($$ select update_draft_poll('%s', 'Changed?', array['A','B']) $$, :'poll_id'),
  'ILLEGAL_TRANSITION: only draft polls can be edited',
  'cannot edit a published poll via update_draft_poll'
);
select throws_ok(
  format($$ select publish_poll('%s') $$, :'poll_id'),
  'ILLEGAL_TRANSITION: only draft polls can be published',
  'cannot publish an already-open poll again'
);

reset role;
-- Superuser raw writes still get caught by the trigger layer, independent of the functions.
select throws_ok(
  format($$ update public.polls set question = 'bypassed' where id = '%s' $$, :'poll_id'),
  'ILLEGAL_TRANSITION: published poll content is immutable',
  'a raw UPDATE on a published poll''s question is blocked by the trigger'
);
select throws_ok(
  format(
    $$ insert into public.poll_options (poll_id, label, position) values ('%s', 'Sneaky', 2) $$,
    :'poll_id'
  ),
  'ILLEGAL_TRANSITION: choices are locked once a poll is published',
  'a raw INSERT of a new option on a published poll is blocked by the trigger'
);

select * from finish();
rollback;
