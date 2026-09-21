-- Follow-up to lock_down_voter_rpc_and_internal_tables, found by re-querying
-- information_schema.role_routine_grants directly rather than trusting `revoke ... from
-- public` alone. Root cause (recorded in full in docs/DEVIATIONS.md): Supabase's cloud
-- default-privilege behaviour (`auto_expose_new_tables`, which also covers functions) grants
-- EXECUTE to `anon` and `authenticated` **by role name** on every new function in the public
-- schema at creation time. `revoke execute on all functions in schema public from public`
-- (the grants migration) only strips the implicit PUBLIC-pseudo-role grant — it does not
-- touch a direct per-role grant, so that default-privilege grant survived untouched. The
-- previous migration's `revoke ... from anon` calls worked (they named the role explicitly),
-- but missed: the same functions still granted to `authenticated` directly, and every
-- internal helper/trigger function, which had never been touched by name at all.
--
-- Two more real gaps this closes:
-- 1. `authenticated` — i.e. any signed-up user, trivial to obtain via email OTP — could still
--    call submit_vote/get_my_vote/get_participant_results/report_poll/check_rate_limit
--    directly via PostgREST with a fabricated voter_key_hash, the same ballot-stuffing/
--    eligibility-bypass issue as the anon case, just gated behind a free signup instead of
--    nothing at all.
-- 2. Every internal helper (_normalise_choice, _resolve_poll_id,
--    _validate_question_and_choices, effective_poll_status, generate_unique_public_code) and
--    trigger function (tg_poll_options_before_change, tg_polls_before_update,
--    tg_votes_after_insert) was directly callable by anon and authenticated. None of these
--    are meant to be called outside another SECURITY DEFINER function's body or the trigger
--    mechanism itself; direct callability is unnecessary attack surface even where the
--    immediate impact is limited.
--
-- service_role is untouched by any of this: Supabase's default-privilege grant covers it too
-- (confirmed via the same information_schema query), so voter-api's service-role client keeps
-- working exactly as before.

revoke execute on function public.submit_vote(text, text, uuid, integer) from authenticated;
revoke execute on function public.get_my_vote(text, text) from authenticated;
revoke execute on function public.get_participant_results(text, text) from authenticated;
revoke execute on function public.report_poll(text, text) from authenticated;
revoke execute on function public.check_rate_limit(text, integer, interval) from authenticated;

revoke execute on function public._normalise_choice(text) from anon, authenticated;
revoke execute on function public._resolve_poll_id(text) from anon, authenticated;
revoke execute on function public._validate_question_and_choices(text, text[]) from anon, authenticated;
revoke execute on function public.effective_poll_status(public.poll_status, timestamptz, timestamptz) from anon, authenticated;
revoke execute on function public.generate_unique_public_code() from anon, authenticated;
revoke execute on function public.tg_poll_options_before_change() from anon, authenticated;
revoke execute on function public.tg_polls_before_update() from anon, authenticated;
revoke execute on function public.tg_votes_after_insert() from anon, authenticated;

-- Organiser-only functions: safe to leave `authenticated`-callable (each starts with its own
-- auth.uid()-is-null / ownership check, so direct PostgREST access can't bypass anything —
-- see docs/DEVIATIONS.md for the full reasoning), but `anon` (unauthenticated) never needed
-- them at all.
revoke execute on function public.close_poll(uuid) from anon;
revoke execute on function public.create_draft_poll(text, text[], public.results_mode, smallint) from anon;
revoke execute on function public.delete_poll(uuid) from anon;
revoke execute on function public.disable_poll(uuid, text) from anon;
revoke execute on function public.enable_poll(uuid) from anon;
revoke execute on function public.get_owner_results(uuid) from anon;
revoke execute on function public.publish_poll(uuid) from anon;
revoke execute on function public.update_draft_poll(uuid, text, text[], public.results_mode, smallint) from anon;
