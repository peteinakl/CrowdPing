# CrowdPing

A mobile-first web app for running a single-question, live audience poll: create a poll,
project a large QR code and URL, and watch percentage-bar results update as people vote —
without any voter registration or app download.

Full specification: [`CrowdPing_Product_Requirements.md`](./CrowdPing_Product_Requirements.md)
(authoritative; this README summarises it). Architecture and repo conventions for future
development: [`CLAUDE.md`](./CLAUDE.md). What was actually built, verified, and deferred in the
initial build: [`docs/BUILD_REPORT.md`](./docs/BUILD_REPORT.md).

## How voting actually works (read this before an event)

- **No registration.** Anyone with the link or QR code can vote once they establish a browser
  session (a signed, `HttpOnly` cookie — never a personal account).
- **"One response per browser," not "one person, one vote."** Clearing cookies, using a private
  window, or switching device/browser lets the same person vote again. A shared browser (a
  kiosk, a family device) represents one participant. This is an audience-feedback tool, not a
  verified election — never present it as one.
- **Changing your answer replaces it, never adds to the total.** A→B keeps the response count
  unchanged.
- **Losing the cookie loses your saved answer and access to results.** There's no
  identity-recovery mechanism in this MVP.
- **Percentages are rounded to one decimal place**, so displayed values can total slightly off
  100%. This is expected, not a bug.

## Who can see what

| Who | Sees |
| --- | --- |
| Anyone with the link, before voting | The question and answer choices. Nothing else. |
| A recognised voter (has voted) | Their own saved answer, plus percentage-only results — live while voting is open (default) or only after closure, depending on the organiser's setting. Never raw counts. |
| The poll's organiser | Full counts, percentages, and total responses, privately, at all times. Never individual voters' identities. |
| Anyone else | Nothing about a poll they don't own beyond what a link holder sees. |

Polls are **unlisted**, not secret — anyone holding a link can read the question. There is no
public directory or search.

## Retention

Closed polls and their responses are intended to be deleted 12 months after closure (an
organiser may delete a poll earlier at any time). No automated retention job exists yet in this
build; see `docs/DEPLOYMENT.md` for what's provisioned versus what's still a manual/future step.

## Repository layout

```
apps/web/        React + TypeScript + Vite frontend, Cloudflare Pages Function proxy
supabase/        Database migrations, Edge Functions (voter-api, organiser-api), pgTAP tests
e2e/             Playwright + load-test workspace (dependencies installed; specs not yet written)
docs/            Environment matrix, deployment runbook, testing guide, deviations log, build report
```

## Getting started (local development)

Requires Node 22, Docker (for the local Supabase stack), and no other accounts.

```bash
npm install
cp .env.example .env               # fill in real local values after the next step
npx supabase start                 # prints local anon/service-role keys — put them in .env
npx supabase functions serve --env-file supabase/.env
npm run dev --workspace apps/web   # http://127.0.0.1:5173
```

Full detail, including how to test the real Cloudflare Pages proxy (not just the dev shortcut)
and how local Google/email sign-in are wired up: [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md).

## Testing

```bash
npx supabase test db                                              # pgTAP: 27/27 passing
cd supabase/tests/concurrency && npm install && node lock-ordering.test.js
npm run build --workspace apps/web                                # type-check + production build
```

See [`docs/TESTING.md`](./docs/TESTING.md) for what's covered, what isn't yet (an automated
Playwright suite was planned but not written this session), and how to run a manual
organiser/voter walkthrough.

## Deployment

Not yet deployed anywhere public. A cloud Supabase staging project is provisioned and migrated;
Cloudflare Pages, a production domain, Google OAuth console credentials, and production SMTP
are still required inputs. Full runbook: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Operational tasks

- **Disabling an abusive poll:** no admin UI exists; an operator (a row in
  `public.operators`) calls the `disable_poll` database function directly. See
  `docs/DEPLOYMENT.md`'s operator runbook section.
- **Rotating the voter-cookie signing key:** `VOTER_COOKIE_SIGNING_KEYS` is an ordered,
  comma-separated list (current key first). Add the new key at the front, keep the old one in
  the list until you're confident no active 90-day cookie still needs it, then remove it.
- **Checking for security/performance regressions after a schema change:** run
  `mcp__supabase__get_advisors` (or the equivalent Dashboard → Advisors page) — this caught a
  real vulnerability during the initial build (see `docs/DEVIATIONS.md`) and should be treated
  as a required step, not optional.

## Out of scope for this product

Multi-question surveys, multiple-selection ballots, ranked voting, free-text answers, quizzes,
word clouds, live Q&A, teams, billing, third-party integrations, AI-generated questions,
identifiable voter records, and verified one-person-one-vote are all explicitly excluded — see
the PRD's §15 for the full list and rationale.
