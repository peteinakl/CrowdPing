-- Single shared definition of "effectively closed" (PRD §10: "Expiry correctness must not
-- depend on a scheduled job. Every write rejects an effectively expired poll, and
-- metadata/results use the same effective-closure rule."). Callers pass in the row's own
-- status/closes_at/disabled_at (already fetched, often already locked) rather than this
-- function re-querying, so it composes safely inside FOR UPDATE transactions.

create function public.effective_poll_status(
  p_status public.poll_status,
  p_closes_at timestamptz,
  p_disabled_at timestamptz
)
returns public.poll_status
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'draft' then 'draft'::public.poll_status
    when p_disabled_at is not null then 'closed'::public.poll_status
    when p_status = 'closed' then 'closed'::public.poll_status
    when p_closes_at is not null and p_closes_at <= now() then 'closed'::public.poll_status
    else 'open'::public.poll_status
  end;
$$;

comment on function public.effective_poll_status is 'The one place "is this poll actually still open right now" is decided. Every function that checks poll state must call this rather than comparing status/closes_at itself.';

-- Voter-facing RPCs take a public_code, not an internal poll id, so voter-api never needs a
-- separate lookup round-trip before calling them. A code only ever resolves once the poll
-- has left draft (public_code is null while draft — see polls_public_code_required_when_published).
create function public._resolve_poll_id(p_public_code text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_poll_id uuid;
begin
  select id into v_poll_id from public.polls where public_code = p_public_code;
  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;
  return v_poll_id;
end;
$$;
