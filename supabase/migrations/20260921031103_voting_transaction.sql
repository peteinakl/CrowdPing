-- The correctness core (PRD §10). Takes a public_code (resolved internally via
-- _resolve_poll_id, added in the helper_effective_status migration) rather than an internal
-- poll id, so voter-api never needs a separate lookup round-trip before calling this.
-- p_voter_key_hash is computed by the voter-api Edge Function from the verified signed
-- cookie — this function never sees a raw voter secret or signing key, only the derived
-- hash, and performs no owner/auth.uid() check because voter identity is the hash itself,
-- not a Supabase-authenticated user.
--
-- Hard errors (no useful "current state" to return) are raised per the error convention.
-- The no-op / saved / conflict branches are all *successful* outcomes with data to return,
-- so they come back as a normal result row rather than an exception.

create function public.submit_vote(
  p_public_code text,
  p_voter_key_hash text,
  p_option_id uuid,
  p_expected_revision integer
)
returns table (status text, option_id uuid, revision integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll_id uuid;
  v_status public.poll_status;
  v_closes_at timestamptz;
  v_disabled_at timestamptz;
  v_effective public.poll_status;
  v_option_exists boolean;
  v_existing_option uuid;
  v_existing_revision integer;
begin
  select id into v_poll_id from public.polls where public_code = p_public_code for update;
  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;

  select p.status, p.closes_at, p.disabled_at
  into v_status, v_closes_at, v_disabled_at
  from public.polls p
  where p.id = v_poll_id;

  v_effective := public.effective_poll_status(v_status, v_closes_at, v_disabled_at);
  if v_effective <> 'open' then
    raise exception 'POLL_CLOSED: voting has closed';
  end if;

  select exists (
    select 1 from public.poll_options o where o.poll_id = v_poll_id and o.id = p_option_id
  ) into v_option_exists;
  if not v_option_exists then
    raise exception 'INVALID_OPTION: option does not belong to this poll';
  end if;

  select v.option_id, v.revision
  into v_existing_option, v_existing_revision
  from public.votes v
  where v.poll_id = v_poll_id and v.voter_key_hash = p_voter_key_hash;

  if not found then
    if p_expected_revision <> 0 then
      -- A stale client thinks it already has a saved vote; it does not. Ask it to reconfirm
      -- against reality (no existing vote) rather than blindly inserting.
      return query select 'conflict'::text, null::uuid, null::integer;
      return;
    end if;

    insert into public.votes (poll_id, voter_key_hash, option_id, revision)
    values (v_poll_id, p_voter_key_hash, p_option_id, 1);

    return query select 'saved'::text, p_option_id, 1;
    return;
  end if;

  if v_existing_option = p_option_id then
    -- Re-selecting the already-saved option is a successful no-op (PRD §10.5).
    return query select 'no_op'::text, v_existing_option, v_existing_revision;
    return;
  end if;

  if v_existing_revision <> p_expected_revision then
    -- Never let a stale/delayed request overwrite a newer confirmed answer (PRD §10.6).
    return query select 'conflict'::text, v_existing_option, v_existing_revision;
    return;
  end if;

  update public.votes
  set option_id = p_option_id,
      revision = v_existing_revision + 1,
      updated_at = now()
  where poll_id = v_poll_id and voter_key_hash = p_voter_key_hash;

  return query select 'saved'::text, p_option_id, v_existing_revision + 1;
end;
$$;

create function public.get_my_vote(p_public_code text, p_voter_key_hash text)
returns table (option_id uuid, revision integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_poll_id uuid := public._resolve_poll_id(p_public_code);
begin
  return query
    select v.option_id, v.revision
    from public.votes v
    where v.poll_id = v_poll_id and v.voter_key_hash = p_voter_key_hash;
end;
$$;
