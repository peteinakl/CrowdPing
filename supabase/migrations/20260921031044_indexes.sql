create index polls_owner_id_created_at_idx on public.polls (owner_id, created_at desc);
create index poll_options_poll_id_position_idx on public.poll_options (poll_id, position);
create index votes_poll_id_option_id_idx on public.votes (poll_id, option_id);
