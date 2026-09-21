-- poll_options: 2–8 rows per poll (count enforced in create_draft_poll/update_draft_poll/
-- publish_poll, not expressible as a single-row CHECK constraint). Direct writes from
-- anon/authenticated are revoked in the grants migration; all mutation goes through
-- SECURITY DEFINER functions so immutability-after-publish can be enforced centrally.

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null,
  position smallint not null,

  constraint poll_options_label_length check (char_length(label) between 1 and 120),
  constraint poll_options_position_range check (position between 0 and 7),
  constraint poll_options_unique_position unique (poll_id, position),
  -- Composite unique target for votes' composite FK (poll_id, option_id) -> (poll_id, id),
  -- which guarantees an option can never be attached to a vote for a different poll.
  constraint poll_options_unique_poll_id_id unique (poll_id, id)
);

comment on table public.poll_options is 'Locked (no insert/update/delete outside SECURITY DEFINER functions) once the parent poll is not draft.';
