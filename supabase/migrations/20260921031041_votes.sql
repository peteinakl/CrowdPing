-- votes: current-state table, one row per (poll, voter). No history stream (PRD §7).
-- Zero RLS policies and zero anon/authenticated grants are applied here — see the
-- rls_default_deny and grants migrations. This table is reachable only through
-- submit_vote()/get_my_vote()/get_participant_results()/get_owner_results().

create table public.votes (
  poll_id uuid not null,
  voter_key_hash text not null,
  option_id uuid not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint votes_pkey primary key (poll_id, voter_key_hash),
  constraint votes_voter_key_hash_format check (voter_key_hash ~ '^[0-9a-f]{64}$'),
  constraint votes_revision_positive check (revision >= 1),
  -- Guarantees the chosen option actually belongs to this poll (not another poll's option id).
  -- ON DELETE CASCADE: options are only ever deleted while still draft (no votes exist yet) or
  -- as part of whole-poll deletion, where cascading through to votes is exactly what PRD §7
  -- requires ("cascade permanent poll deletion through choices and responses").
  constraint votes_option_belongs_to_poll foreign key (poll_id, option_id)
    references public.poll_options (poll_id, id) on delete cascade
);

comment on table public.votes is 'voter_key_hash = HMAC-SHA256(derivation_key, poll_public_code || voter_secret), computed in the voter-api Edge Function. No key material or raw voter identity is ever stored here.';
