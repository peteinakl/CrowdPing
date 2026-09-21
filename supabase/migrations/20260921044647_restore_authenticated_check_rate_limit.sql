-- Regression from lock_down_internal_helpers_and_default_grants: that migration revoked
-- `authenticated` EXECUTE on check_rate_limit as part of locking down the voter-identity
-- functions, without accounting for organiser-api's OWN legitimate call to it — POST
-- /organiser-api/polls rate-limits poll creation via the forwarded-JWT (authenticated) client,
-- not service-role. The revoke broke every draft creation with a masked 500
-- ("Unhandled backend error") until this fix.
--
-- Unlike submit_vote/get_my_vote/get_participant_results/report_poll, check_rate_limit itself
-- doesn't trust a caller-supplied voter identity to bypass anything — it's a shared counter
-- ledger keyed by whatever string the caller passes. Direct PostgREST access by `authenticated`
-- risks only minor griefing (incrementing/resetting a rate-limit bucket for a key an attacker
-- can guess), not an identity or eligibility bypass, so re-granting it here is safe.
-- `anon` stays revoked: voter-api's own use of check_rate_limit moved to the service-role
-- client in the earlier lock-down migration, so anon has no legitimate caller left.

grant execute on function public.check_rate_limit(text, integer, interval) to authenticated;
