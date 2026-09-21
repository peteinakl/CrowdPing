-- Poll lifecycle and the polls table (PRD §7, plus additive columns recorded in docs/DEVIATIONS.md:
-- expiry_days, response_count, disabled_at/disabled_reason).

create type public.poll_status as enum ('draft', 'open', 'closed');
create type public.results_mode as enum ('after_vote', 'after_close');

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  public_code text unique,
  question text not null,
  status public.poll_status not null default 'draft',
  participant_results_mode public.results_mode not null default 'after_vote',
  expiry_days smallint not null default 7,
  response_count integer not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  closes_at timestamptz,
  closed_at timestamptz,
  disabled_at timestamptz,
  disabled_reason text,

  constraint polls_question_length check (char_length(question) between 1 and 240),
  constraint polls_expiry_days_range check (expiry_days between 1 and 30),
  constraint polls_response_count_nonnegative check (response_count >= 0),
  constraint polls_public_code_required_when_published check (
    (status = 'draft' and public_code is null) or
    (status <> 'draft' and public_code is not null)
  ),
  constraint polls_published_at_set check (status = 'draft' or published_at is not null),
  constraint polls_closed_at_set check (status <> 'closed' or closed_at is not null)
);

comment on table public.polls is 'One row per poll. Question/options are immutable once status leaves draft (enforced in migration 20260921031112_immutability_triggers.sql).';
comment on column public.polls.public_code is '16-char Crockford base32 code, assigned at publish time by publish_poll(). Null while draft.';
