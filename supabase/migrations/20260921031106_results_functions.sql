-- Three different shapes of the same underlying data (PRD §8/§9), each its own function so
-- the eligibility rule for each audience lives in exactly one place:
--   get_public_poll          — anyone with the link, no vote required. No aggregates.
--   get_participant_results  — only a recognised voter for THIS poll. Percentages only.
--   get_owner_results        — only the poll owner. Full counts/percentages/total.

create function public.get_public_poll(p_public_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_poll record;
  v_options jsonb;
begin
  select id, question, status, closes_at, disabled_at, participant_results_mode
  into v_poll
  from public.polls
  where public_code = p_public_code;

  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;

  select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'position', o.position) order by o.position)
  into v_options
  from public.poll_options o
  where o.poll_id = v_poll.id;

  return jsonb_build_object(
    'question', v_poll.question,
    'status', public.effective_poll_status(v_poll.status, v_poll.closes_at, v_poll.disabled_at),
    'participant_results_mode', v_poll.participant_results_mode,
    'options', coalesce(v_options, '[]'::jsonb)
  );
end;
$$;

create function public.get_participant_results(p_public_code text, p_voter_key_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_poll_id uuid := public._resolve_poll_id(p_public_code);
  v_poll record;
  v_effective public.poll_status;
  v_has_vote boolean;
  v_total integer;
  v_results jsonb;
begin
  select status, closes_at, disabled_at, participant_results_mode, response_count
  into v_poll
  from public.polls
  where id = v_poll_id;

  v_effective := public.effective_poll_status(v_poll.status, v_poll.closes_at, v_poll.disabled_at);

  select exists (
    select 1 from public.votes v where v.poll_id = v_poll_id and v.voter_key_hash = p_voter_key_hash
  ) into v_has_vote;

  if not v_has_vote then
    raise exception 'UNAUTHORISED: no recorded vote for this browser';
  end if;

  if v_poll.participant_results_mode = 'after_close' and v_effective <> 'closed' then
    return jsonb_build_object(
      'status', 'pending',
      'is_final', false,
      'server_time', now(),
      'options', null
    );
  end if;

  v_total := v_poll.response_count;

  select jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'label', o.label,
      'position', o.position,
      'percentage', case when v_total = 0 then 0
        else round(100.0 * coalesce(c.n, 0) / v_total, 1) end
    ) order by o.position
  )
  into v_results
  from public.poll_options o
  left join (
    select option_id, count(*) as n from public.votes where poll_id = v_poll_id group by option_id
  ) c on c.option_id = o.id
  where o.poll_id = v_poll_id;

  return jsonb_build_object(
    'status', v_effective,
    'is_final', v_effective = 'closed',
    'server_time', now(),
    'options', coalesce(v_results, '[]'::jsonb)
  );
end;
$$;

create function public.get_owner_results(p_poll_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_poll record;
  v_effective public.poll_status;
  v_total integer;
  v_results jsonb;
begin
  if v_caller is null then
    raise exception 'UNAUTHORISED: sign in required';
  end if;

  select owner_id, status, closes_at, disabled_at, response_count
  into v_poll
  from public.polls
  where id = p_poll_id;

  if not found then
    raise exception 'POLL_NOT_FOUND: no such poll';
  end if;
  if v_poll.owner_id <> v_caller then
    raise exception 'UNAUTHORISED: not the poll owner';
  end if;

  v_effective := public.effective_poll_status(v_poll.status, v_poll.closes_at, v_poll.disabled_at);
  v_total := v_poll.response_count;

  select jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'label', o.label,
      'position', o.position,
      'count', coalesce(c.n, 0),
      'percentage', case when v_total = 0 then 0
        else round(100.0 * coalesce(c.n, 0) / v_total, 1) end
    ) order by o.position
  )
  into v_results
  from public.poll_options o
  left join (
    select option_id, count(*) as n from public.votes where poll_id = p_poll_id group by option_id
  ) c on c.option_id = o.id
  where o.poll_id = p_poll_id;

  return jsonb_build_object(
    'status', v_effective,
    'total_responses', v_total,
    'server_time', now(),
    'options', coalesce(v_results, '[]'::jsonb)
  );
end;
$$;
