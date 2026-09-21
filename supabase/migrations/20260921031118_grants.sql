-- Postgres grants EXECUTE on every newly created function to PUBLIC by default, which would
-- otherwise let anon/authenticated call every internal helper directly. Strip that first,
-- then grant back exactly what each Edge Function surface needs (PRD §8: "revoke default
-- execution grants" for SECURITY DEFINER functions — applied here to every function in the
-- schema for consistency, not just the SECURITY DEFINER ones).

revoke execute on all functions in schema public from public;

-- voter-api surface (anon key only, no Supabase JWT — see supabase/functions/voter-api)
grant execute on function public.get_public_poll(text) to anon;
grant execute on function public.submit_vote(text, text, uuid, integer) to anon;
grant execute on function public.get_my_vote(text, text) to anon;
grant execute on function public.get_participant_results(text, text) to anon;
grant execute on function public.report_poll(text, text) to anon;
grant execute on function public.check_rate_limit(text, integer, interval) to anon;

-- organiser-api surface (forwarded Authorization: Bearer <JWT> — see
-- supabase/functions/organiser-api)
grant execute on function public.create_draft_poll(text, text[], public.results_mode, smallint) to authenticated;
grant execute on function public.update_draft_poll(uuid, text, text[], public.results_mode, smallint) to authenticated;
grant execute on function public.publish_poll(uuid) to authenticated;
grant execute on function public.close_poll(uuid) to authenticated;
grant execute on function public.delete_poll(uuid) to authenticated;
grant execute on function public.get_owner_results(uuid) to authenticated;
grant execute on function public.disable_poll(uuid, text) to authenticated;
grant execute on function public.enable_poll(uuid) to authenticated;
grant execute on function public.check_rate_limit(text, integer, interval) to authenticated;

-- Everything else (effective_poll_status, _resolve_poll_id, generate_unique_public_code,
-- _normalise_choice, _validate_question_and_choices, the three trigger functions) stays revoked from
-- anon/authenticated: they are internal helpers only ever invoked from inside another
-- SECURITY DEFINER function's own execution context, or by the trigger mechanism itself
-- (which does not require its own EXECUTE grant).
