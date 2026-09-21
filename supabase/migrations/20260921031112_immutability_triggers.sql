-- Defense-in-depth alongside the functions above (PRD §3: "Do not use client-only
-- restrictions" / PRD §8: "Enforce state transitions... in database functions/triggers").
-- The functions already gate these rules, and grants (next-but-one migration) mean only
-- SECURITY DEFINER functions can write to polls/poll_options at all — these triggers exist
-- to catch a bug in our own functions, not merely to stop an external caller who is already
-- blocked at the grant layer.

create function public.tg_polls_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Content columns are only mutable while the row was (before this update) still a draft.
  if (
    new.question is distinct from old.question or
    new.participant_results_mode is distinct from old.participant_results_mode or
    new.expiry_days is distinct from old.expiry_days or
    new.public_code is distinct from old.public_code or
    new.owner_id is distinct from old.owner_id
  ) and old.status <> 'draft' then
    raise exception 'ILLEGAL_TRANSITION: published poll content is immutable';
  end if;

  -- Only two status transitions ever exist. Same-status updates (e.g. response_count ticking
  -- up, or an abuse disable/enable) are not "transitions" and are left alone here.
  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status = 'open') or
      (old.status = 'open' and new.status = 'closed')
    ) then
      raise exception 'ILLEGAL_TRANSITION: % -> % is not a legal poll state transition', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

create trigger polls_before_update
  before update on public.polls
  for each row
  execute function public.tg_polls_before_update();

-- poll_options: block INSERT/UPDATE once the parent poll is non-draft. DELETE is
-- deliberately left ungated here: the only two paths that ever delete a poll_options row are
-- update_draft_poll() (which already asserts status = 'draft' itself) and the ON DELETE
-- CASCADE from delete_poll() removing the whole poll (which already asserts status IN
-- (draft, closed) itself) — gating DELETE here as well would require distinguishing "a
-- cascade from deleting the parent" from "someone deleting one option directly", which is not
-- reliably observable from inside this trigger.
create function public.tg_poll_options_before_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.poll_status;
begin
  select status into v_status from public.polls where id = coalesce(new.poll_id, old.poll_id);

  if v_status is distinct from 'draft' then
    raise exception 'ILLEGAL_TRANSITION: choices are locked once a poll is published';
  end if;

  return new;
end;
$$;

create trigger poll_options_before_insert_update
  before insert or update on public.poll_options
  for each row
  execute function public.tg_poll_options_before_change();
