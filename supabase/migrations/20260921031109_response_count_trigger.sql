-- polls.response_count is the single source of truth for "total responses" used by the
-- results functions. It only moves on INSERT — changing an existing vote (UPDATE) never
-- touches it, so "A to B keeps the total unchanged" (PRD §10.7) holds structurally rather
-- than depending on submit_vote() remembering to skip an increment.

create function public.tg_votes_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.polls set response_count = response_count + 1 where id = new.poll_id;
  return new;
end;
$$;

create trigger votes_after_insert
  after insert on public.votes
  for each row
  execute function public.tg_votes_after_insert();
