-- Lifecycle transitions. Each locks the poll row FOR UPDATE so publish/close/delete and
-- submit_vote (added next) serialise deterministically against each other (PRD §10:
-- "Closing and voting acquire the same poll lock so their order is deterministic").

create function public.publish_poll(p_poll_id uuid)
returns table (public_code text, closes_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_status public.poll_status;
  v_expiry_days smallint;
  v_option_count int;
  v_code text;
  v_closes_at timestamptz;
begin
  if v_caller is null then
    raise exception 'UNAUTHORISED: sign in required';
  end if;

  select owner_id, status, expiry_days into v_owner, v_status, v_expiry_days
  from public.polls
  where id = p_poll_id
  for update;

  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;
  if v_owner <> v_caller then
    raise exception 'UNAUTHORISED: not the poll owner';
  end if;
  if v_status <> 'draft' then
    raise exception 'ILLEGAL_TRANSITION: only draft polls can be published';
  end if;

  select count(*) into v_option_count from public.poll_options where poll_id = p_poll_id;
  if v_option_count < 2 or v_option_count > 8 then
    raise exception 'VALIDATION_ERROR: a poll needs 2-8 choices to publish';
  end if;

  v_code := public.generate_unique_public_code();
  v_closes_at := now() + (v_expiry_days || ' days')::interval;

  update public.polls
  set status = 'open',
      public_code = v_code,
      published_at = now(),
      closes_at = v_closes_at
  where id = p_poll_id;

  return query select v_code, v_closes_at;
end;
$$;

create function public.close_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_status public.poll_status;
begin
  if v_caller is null then
    raise exception 'UNAUTHORISED: sign in required';
  end if;

  select owner_id, status into v_owner, v_status
  from public.polls
  where id = p_poll_id
  for update;

  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;
  if v_owner <> v_caller then
    raise exception 'UNAUTHORISED: not the poll owner';
  end if;
  if v_status = 'draft' then
    raise exception 'ILLEGAL_TRANSITION: publish before closing';
  end if;
  if v_status = 'closed' then
    raise exception 'ILLEGAL_TRANSITION: poll is already closed';
  end if;

  update public.polls
  set status = 'closed', closed_at = now()
  where id = p_poll_id;
end;
$$;

create function public.delete_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_owner uuid;
  v_status public.poll_status;
begin
  if v_caller is null then
    raise exception 'UNAUTHORISED: sign in required';
  end if;

  select owner_id, status into v_owner, v_status
  from public.polls
  where id = p_poll_id
  for update;

  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;
  if v_owner <> v_caller then
    raise exception 'UNAUTHORISED: not the poll owner';
  end if;
  if v_status = 'open' then
    raise exception 'ILLEGAL_TRANSITION: close the poll before deleting it';
  end if;

  delete from public.polls where id = p_poll_id;
end;
$$;
