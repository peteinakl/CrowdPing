-- Default-deny posture (PRD §8). Tables are owned by the migration role, which is exempt
-- from RLS by default; SECURITY DEFINER functions (owned by that same role, added in later
-- migrations) therefore bypass RLS to perform their own internally-authorised reads/writes,
-- while the anon/authenticated request-serving roles remain fully subject to these policies.

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;

-- Start from nothing: explicitly strip whatever Supabase's default schema privileges granted,
-- then grant back only what organiser-api's RLS-scoped reads need.
revoke all on public.polls from public, anon, authenticated;
revoke all on public.poll_options from public, anon, authenticated;
revoke all on public.votes from public, anon, authenticated;

grant select on public.polls to authenticated;
grant select on public.poll_options to authenticated;
-- votes: no grant at all for anon/authenticated. Reachable only through
-- submit_vote()/get_my_vote()/get_participant_results()/get_owner_results(), added later.

-- Owner-only visibility. There is no anon policy on polls/poll_options: an unauthenticated
-- link holder reads published poll content exclusively through get_public_poll(), never
-- through a direct table select, per PRD §8 "Public routes call only purpose-built server
-- operations."
create policy polls_owner_select on public.polls
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy poll_options_owner_select on public.poll_options
  for select
  to authenticated
  using (
    exists (
      select 1 from public.polls
      where polls.id = poll_options.poll_id
        and polls.owner_id = (select auth.uid())
    )
  );

-- No insert/update/delete policies for anon/authenticated on any of the three tables:
-- every mutation is routed through a SECURITY DEFINER function so publication immutability,
-- lifecycle transitions, and the voting transaction's invariants are enforced in one place.
