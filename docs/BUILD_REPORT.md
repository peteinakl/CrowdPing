# Build report

Date: 2026-09-21. This documents what was actually built and verified in this session, with
real results rather than assumed ones, per the PRD's own instruction (§14: "state exactly what
remains unverified... never claim that a deployed or tested production service exists without
evidence").

## What was built

- **Database:** 19 migrations (16 original + 3 follow-up fixes — see `docs/DEVIATIONS.md`)
  implementing the full schema, default-deny RLS, the atomic voting transaction, the three
  results functions, lifecycle transitions, rate limiting, and abuse reporting.
- **Backend:** Two Supabase Edge Functions (`voter-api`, `organiser-api`) implementing the
  PRD §9 API contract, with the voter-cookie HMAC credential and origin/rate-limit enforcement.
- **Frontend:** A React 19 + TypeScript + Tailwind v4 app covering all 9 PRD-specified routes
  (landing, sign-in, auth callback, dashboard, create, manage, present, participate, 404),
  built with an intentional visual system (single typeface, brand-derived colour scale, Radix
  primitives for accessible ballot/dialog/toast behaviour) rather than framework defaults.
- **Infrastructure:** a Cloudflare Pages Function proxy (`apps/web/functions/api/[[path]].ts`),
  QR generation in-app via the `qrcode` package, and a provisioned cloud Supabase staging
  project (`sjddczimxefzmvimjqwu`) with all migrations and Edge Functions deployed.

## Verified, with real evidence

- **pgTAP:** `npx supabase test db` → **27/27 assertions pass**, 4 files (RLS default-deny,
  owner isolation, publish immutability, the full voting-transaction state machine).
- **Concurrency:** a real two-Postgres-connection script
  (`supabase/tests/concurrency/lock-ordering.test.js`) proved both lock orderings —
  vote-acquires-first and close-acquires-first — resolve deterministically with exactly one
  vote row either way and the correct final poll status. Real output:
  ```
  Scenario 1: submit_vote acquires the lock first...
    ok - vote result status is 'saved'
    ok - close_poll actually blocked on the lock (waited 811ms)
    ok - exactly one vote row exists
    ok - poll ended up closed
    ok - response_count reflects the vote that landed before closure
  Scenario 2: close_poll acquires the lock first...
    ok - submit_vote actually blocked on the lock (waited 814ms)
    ok - submit_vote raised an error once it proceeded
    ok - the error is POLL_CLOSED, not something else
    ok - no vote was recorded
  ```
- **Frontend build:** `npm run build --workspace apps/web` → zero TypeScript errors, clean
  Vite build, no chunk-size warning after the code-splitting fix (main voter-path chunk:
  ~329 KB / 105 KB gzip, down from ~626 KB / 187 KB gzip).
- **Google sign-in completed end-to-end, by the user, for real.** After registering
  `http://127.0.0.1:54321/auth/v1/callback` in Google Cloud Console, the user's own browser
  completed the full Google consent flow and received a valid Supabase session JWT for their
  real account. That surfaced a second, separate bug: the app's canonical local origin was
  `:8788` (the Cloudflare proxy port), which has a local-only wrangler serving quirk (see
  `docs/ENVIRONMENT.md`) that 404s on `/auth/callback` — the auth itself had genuinely
  succeeded, but the app couldn't load to consume it. Fixed by moving the local canonical origin
  to `:5173`; re-verified by replaying the user's real callback token through `/auth/callback`
  at the corrected origin (parsed correctly, landed signed-in on `/dashboard`, no errors beyond
  an expected "token issued a while ago" staleness warning from reusing an older token).
- **Manual end-to-end browser walkthrough** (Playwright MCP against the local stack, real
  Supabase auth, real database): sign-in via email OTP (code retrieved from the local Mailpit
  inbox); create a draft; publish (confirmation dialog, code
  and QR generated); vote as a fresh browser session (ballot renders, submits, shows
  percentage-only results, no vote counts); change an existing vote (revision incremented, total
  unchanged); revisit as the same recognised voter (saved answer + results recovered); view the
  organiser's private results (accurate counts, matching the voter-visible percentages); view
  the presentation join screen (large QR, question, URL) and results screen (two-column layout,
  bars, still-visible QR) at a 1920×1080 viewport; close voting; revisit as the recognised voter
  after closure (final answer + final results, "Change my answer" correctly hidden).
- **Screenshots taken and inspected** of the presentation join and results views at
  1920×1080 confirmed the QR is large, legible, dark-on-white with a visible quiet zone, and the
  layout matches PRD §4's "prioritise the question, QR and URL" requirement.
- **Cloud project security posture:** `mcp__supabase__get_advisors` (security) shows zero
  ERROR-level findings after the fixes in `docs/DEVIATIONS.md`; remaining WARN/INFO findings
  are confirmed intentional (organiser functions protected by internal ownership checks;
  `get_public_poll` intentionally public; RLS-enabled-no-policy on tables reachable only via
  `SECURITY DEFINER` functions).

## Bugs found and fixed during integration (not left as known issues)

Full detail in `docs/DEVIATIONS.md`. Summary: a nested vs. flat error-envelope mismatch that
broke every `err.code` check in the frontend; a silently-swallowed vote-revision-conflict that
would have shown a stale answer as a successful save; a partial-update contract mismatch that
broke poll creation entirely; a Radix controlled/uncontrolled component warning; and — the most
significant — voter-facing database functions and three tables being reachable directly via
PostgREST with just the public anon key (or, after a first incomplete fix, by any signed-up
user), which would have let an attacker bypass the entire cookie-based voter-identity model and
stuff unlimited fake ballots; and a self-inflicted regression from that same security fix, which
over-revoked `check_rate_limit` and broke poll creation entirely until caught by immediately
re-testing the feature (not just re-running the pre-existing test suite, which didn't cover this
path). All were found through actual testing and advisor tooling, not assumed away, and all are
fixed and re-verified.

## Explicitly deferred, with the exact follow-up action

| Item | Why deferred | Follow-up |
| --- | --- | --- |
| Playwright e2e suite | Not written this session — see `docs/TESTING.md` | Write the specs listed there; `@playwright/test` and `@axe-core/playwright` are already installed |
| Cloud project Edge Function secrets | No secrets-management tool in the Supabase MCP surface used here | Set via Dashboard or `supabase secrets set` with a personal access token — see `docs/ENVIRONMENT.md` |
| Cloudflare Pages project + domain | No authenticated Cloudflare account in this session | `wrangler login` or Dashboard connect — see `docs/DEPLOYMENT.md` |
| Google OAuth: real end-to-end round trip | Needs the redirect URI registered in Google Cloud Console, then a real interactive consent | Register `http://127.0.0.1:54321/auth/v1/callback` (local) and the cloud project's callback (staging); this was requested of the user during the build |
| Production SMTP | No credentials supplied | Configure a real provider before relying on staging/production for real sign-ins |
| Physical QR scanning, real devices (PRD A7) | Explicit manual/pilot step per the PRD itself | Scan the projected code at real room distance once deployed |
| Load testing at PRD §13 pilot scale | `e2e/load/vote-burst.load.ts` not written; needs real deployed infra regardless | Write the script, run it against a deployed staging project |
| Production domain / final `APP_BASE_URL` | Not yet supplied | Provide the value; every config path already reads it |
| Backup/restore exercise (PRD §12) | Needs the production project's backup configuration | Perform once that project exists |

## Known limitations carried into the design (not bugs, documented trade-offs)

- Postgres-backed rate limiting is a correctness backstop, not tuned for the PRD §13 pilot
  volume of results-read traffic — see `docs/DEVIATIONS.md`'s last section.
- `wrangler pages dev`'s local SPA-fallback false positive means the Cloudflare proxy's
  `/api/*` behaviour was verified locally in full, but the app-shell SPA fallback was verified
  via `vite preview` against a real production build rather than through wrangler directly —
  see `docs/TESTING.md`.
