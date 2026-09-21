-- Draft creation/editing. SECURITY DEFINER because anon/authenticated have no direct
-- INSERT/UPDATE/DELETE grant on polls/poll_options (see the grants migration) — but
-- auth.uid() still resolves to the calling user's id, since it reads the JWT-claims GUC
-- set per-request, which SECURITY DEFINER does not change (only the executing role changes).
--
-- Error convention used by every function in this schema (parsed by
-- supabase/functions/_shared/errors.ts): raise exception 'CODE: human message', where CODE
-- is one of VALIDATION_ERROR, UNAUTHORISED, POLL_NOT_FOUND, POLL_CLOSED, INVALID_OPTION,
-- REVISION_CONFLICT, ILLEGAL_TRANSITION.

create function public._normalise_choice(p_label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(normalize(trim(both from p_label), nfkc));
$$;

create function public._validate_question_and_choices(p_question text, p_choices text[])
returns text -- trimmed, validated question; raises on any problem
language plpgsql
set search_path = ''
as $$
declare
  v_question text := trim(both from p_question);
  v_choice text;
  v_seen text[] := '{}';
  v_norm text;
begin
  if char_length(v_question) < 1 or char_length(v_question) > 240 then
    raise exception 'VALIDATION_ERROR: question must be 1-240 characters';
  end if;

  if array_length(p_choices, 1) is null or array_length(p_choices, 1) < 2 or array_length(p_choices, 1) > 8 then
    raise exception 'VALIDATION_ERROR: a poll needs 2-8 choices';
  end if;

  foreach v_choice in array p_choices loop
    if char_length(trim(both from v_choice)) < 1 or char_length(trim(both from v_choice)) > 120 then
      raise exception 'VALIDATION_ERROR: each choice must be 1-120 characters';
    end if;
    v_norm := public._normalise_choice(v_choice);
    if v_norm = '' then
      raise exception 'VALIDATION_ERROR: choices cannot be empty after trimming';
    end if;
    if v_norm = any (v_seen) then
      raise exception 'VALIDATION_ERROR: duplicate choice: %', trim(both from v_choice);
    end if;
    v_seen := array_append(v_seen, v_norm);
  end loop;

  return v_question;
end;
$$;

create function public.create_draft_poll(
  p_question text,
  p_choices text[],
  p_participant_results_mode public.results_mode default 'after_vote',
  p_expiry_days smallint default 7
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_question text;
  v_poll_id uuid;
  v_choice text;
  v_position smallint := 0;
begin
  if v_caller is null then
    raise exception 'UNAUTHORISED: sign in required';
  end if;

  if p_expiry_days < 1 or p_expiry_days > 30 then
    raise exception 'VALIDATION_ERROR: expiry must be 1-30 days';
  end if;

  v_question := public._validate_question_and_choices(p_question, p_choices);

  insert into public.polls (owner_id, question, participant_results_mode, expiry_days)
  values (v_caller, v_question, p_participant_results_mode, p_expiry_days)
  returning id into v_poll_id;

  foreach v_choice in array p_choices loop
    insert into public.poll_options (poll_id, label, position)
    values (v_poll_id, trim(both from v_choice), v_position);
    v_position := v_position + 1;
  end loop;

  return v_poll_id;
end;
$$;

create function public.update_draft_poll(
  p_poll_id uuid,
  p_question text,
  p_choices text[],
  p_participant_results_mode public.results_mode default 'after_vote',
  p_expiry_days smallint default 7
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_question text;
  v_choice text;
  v_position smallint := 0;
  v_status public.poll_status;
  v_owner uuid;
begin
  if v_caller is null then
    raise exception 'UNAUTHORISED: sign in required';
  end if;

  select status, owner_id into v_status, v_owner
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
    raise exception 'ILLEGAL_TRANSITION: only draft polls can be edited';
  end if;

  if p_expiry_days < 1 or p_expiry_days > 30 then
    raise exception 'VALIDATION_ERROR: expiry must be 1-30 days';
  end if;

  v_question := public._validate_question_and_choices(p_question, p_choices);

  update public.polls
  set question = v_question,
      participant_results_mode = p_participant_results_mode,
      expiry_days = p_expiry_days
  where id = p_poll_id;

  -- Replace the option set wholesale. Safe: options can only be edited while draft, and a
  -- draft poll has never accepted a vote (voting requires status = 'open'), so there is
  -- nothing to preserve option identity for yet. The immutability trigger blocks this same
  -- statement shape once the poll leaves draft.
  delete from public.poll_options where poll_id = p_poll_id;

  foreach v_choice in array p_choices loop
    insert into public.poll_options (poll_id, label, position)
    values (p_poll_id, trim(both from v_choice), v_position);
    v_position := v_position + 1;
  end loop;
end;
$$;
