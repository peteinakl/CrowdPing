-- Security fix found by mcp__supabase__get_advisors after the initial push (docs/DEVIATIONS.md
-- has the full writeup). Two real gaps, not false positives:
--
-- 1. submit_vote/get_my_vote/get_participant_results/report_poll/check_rate_limit were granted
--    to `anon`, which is the SAME public API key shipped in the browser bundle. Any client can
--    call a granted SECURITY DEFINER function directly via PostgREST's /rest/v1/rpc/<fn>,
--    completely bypassing voter-api's cookie verification — an attacker could pass any
--    fabricated p_voter_key_hash to submit_vote and stuff unlimited fake ballots, or read
--    another "voter"'s results by guessing/fabricating their hash. The Edge Function's origin
--    check and rate limiting are also bypassed this way. get_public_poll is the one exception
--    left grantable to anon: its only input is a poll's public_code and it returns nothing
--    that isn't already meant to be publicly reachable by anyone holding that code (PRD §2).
--
-- 2. rate_limit_buckets/abuse_reports/operators were created with RLS left disabled entirely
--    (unlike polls/poll_options/votes, which enable RLS with no policies). Supabase's default
--    auto_expose_new_tables behaviour means anon/authenticated already had direct PostgREST
--    table access — e.g. `GET /rest/v1/operators` would have listed which auth.users are
--    operators, and `rate_limit_buckets` could potentially be reset/manipulated directly.
--
-- Fix: voter-api switches from the anon key to the service-role key (server-side only, never
-- forwarded to the browser — this is the standard Supabase pattern for a function whose
-- authorization logic can't be expressed as anon-safe RLS/grants; it does not conflict with
-- PRD §6's "never add a service-role credential to *proxied browser requests*", which is about
-- not letting the browser itself hold or transmit that key). anon execute is revoked below; the
-- three tables get the same RLS-enabled-no-policy, zero-grant posture as votes.

revoke execute on function public.submit_vote(text, text, uuid, integer) from anon;
revoke execute on function public.get_my_vote(text, text) from anon;
revoke execute on function public.get_participant_results(text, text) from anon;
revoke execute on function public.report_poll(text, text) from anon;
revoke execute on function public.check_rate_limit(text, integer, interval) from anon;

alter table public.rate_limit_buckets enable row level security;
alter table public.abuse_reports enable row level security;
alter table public.operators enable row level security;

revoke all on public.rate_limit_buckets from public, anon, authenticated;
revoke all on public.abuse_reports from public, anon, authenticated;
revoke all on public.operators from public, anon, authenticated;
