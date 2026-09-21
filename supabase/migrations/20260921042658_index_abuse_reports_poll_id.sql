-- Flagged by mcp__supabase__get_advisors (performance): abuse_reports.poll_id had no covering
-- index for its FK to polls. Low-traffic table, but a one-line, zero-risk fix.
create index abuse_reports_poll_id_idx on public.abuse_reports (poll_id);
