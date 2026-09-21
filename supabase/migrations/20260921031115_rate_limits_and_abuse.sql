-- PRD §12: distributed limits on poll creation/session issuance/vote writes/result reads,
-- an abuse-report route, and an operator's ability to disable a reported poll.

create table public.rate_limit_buckets (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
comment on table public.rate_limit_buckets is 'Fixed-window counters keyed by callers (e.g. vote:<poll_id>:<voter_key_hash>, session:<ip>, results:<poll_id>:<voter_key_hash>). Edge Functions call check_rate_limit() before the guarded action.';

create function public.check_rate_limit(p_key text, p_max integer, p_window interval default interval '1 minute')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limit_buckets (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set count = case
          when public.rate_limit_buckets.window_start <= now() - p_window then 1
          else public.rate_limit_buckets.count + 1
        end,
        window_start = case
          when public.rate_limit_buckets.window_start <= now() - p_window then now()
          else public.rate_limit_buckets.window_start
        end
  returning count into v_count;

  return v_count <= p_max;
end;
$$;
comment on function public.check_rate_limit is 'Returns true if the caller is still within p_max calls per p_window for this key. Known tuning tension (docs/DEVIATIONS.md): PRD §13''s pilot load implies ~500 rps of eligible-voter results reads; this Postgres-backed limiter is the correctness backstop for MVP, with an in-Edge-Function token bucket as a documented follow-up if load testing shows contention.';

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  reporter_note text,
  reported_at timestamptz not null default now()
);

create function public.report_poll(p_public_code text, p_reporter_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll_id uuid := public._resolve_poll_id(p_public_code);
begin
  insert into public.abuse_reports (poll_id, reporter_note) values (v_poll_id, p_reporter_note);
end;
$$;
comment on function public.report_poll is 'Open to any link holder, including anonymous voters — no auth.uid() check. Called from voter-api.';

create table public.operators (
  user_id uuid primary key references auth.users (id) on delete cascade
);
comment on table public.operators is 'Minimal allowlist so disable_poll/enable_poll can check membership. No admin UI exists for MVP (PRD §4''s screen list has none); adding an operator is a runbook step (docs/DEPLOYMENT.md), e.g. `insert into public.operators (user_id) values (...)`.';

create function public.disable_poll(p_poll_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not exists (select 1 from public.operators where user_id = v_caller) then
    raise exception 'UNAUTHORISED: operator access required';
  end if;

  update public.polls set disabled_at = now(), disabled_reason = p_reason where id = p_poll_id;
  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;
end;
$$;

create function public.enable_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not exists (select 1 from public.operators where user_id = v_caller) then
    raise exception 'UNAUTHORISED: operator access required';
  end if;

  update public.polls set disabled_at = null, disabled_reason = null where id = p_poll_id;
  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;
end;
$$;
