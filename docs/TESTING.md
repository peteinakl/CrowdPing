# Testing

## What exists and passes today

| Layer | Command | Status |
| --- | --- | --- |
| Database (pgTAP) | `npx supabase test db` | 27/27 assertions pass, 4 files |
| Voting-transaction concurrency | `cd supabase/tests/concurrency && node lock-ordering.test.js` | Both lock orderings pass (see `docs/BUILD_REPORT.md`) |
| Frontend type-check + build | `npm run build --workspace apps/web` | Zero type errors, builds cleanly |
| Manual end-to-end (browser) | — | Full organiser + voter journey walked through and verified; see `docs/BUILD_REPORT.md` |

## What does not exist yet

An automated Playwright e2e suite (the plan's §10/§13 acceptance-criteria coverage —
`auth.spec.ts`, `poll-lifecycle.spec.ts`, `voting.spec.ts`, `results-eligibility.spec.ts`,
`presentation.spec.ts`, `invite-link.spec.ts`, `network-resilience.spec.ts`,
`accessibility.spec.ts`, `privacy-boundaries.spec.ts`, `canonical-urls.spec.ts`,
`deployment-routing.spec.ts`) and a Vitest config-validation unit test were planned but not
written this session — the `e2e/` workspace has its dependencies installed
(`@playwright/test`, `@axe-core/playwright`, `pg`, `autocannon`) and a `test` script, but no
spec files yet. This is the single largest piece of planned work not completed. Everything
those specs would have covered was instead verified manually, once, via a real browser
(Playwright MCP) during the build — see `docs/BUILD_REPORT.md` for exactly what was exercised
and what wasn't. Manual verification is not a substitute for a regression suite; treat writing
these specs as the top priority before this codebase changes further.

Before writing them: `npx playwright install` (browsers aren't downloaded yet), then follow the
plan's original spec-to-acceptance-criteria mapping (each spec file's ID references, e.g. A1,
A4/A5, A8–A12) as the checklist — it was designed against the *pre-fix* API contract
assumptions, so re-verify request/response shapes against the current `apps/web/src/lib/types.ts`
and the Edge Function handlers rather than assuming the original plan's field names are still
accurate (several were corrected during integration — see `docs/DEVIATIONS.md`).

## Running what exists

```bash
# 1. Local stack up
npx supabase start
npx supabase functions serve --env-file supabase/.env

# 2. Database tests
npx supabase test db

# 3. Concurrency test
cd supabase/tests/concurrency && npm install && node lock-ordering.test.js

# 4. Frontend build/type-check
npm run build --workspace apps/web

# 5. Manual walkthrough
npm run dev --workspace apps/web   # :5173, with dev-proxy to Supabase Functions
# sign in via email OTP (code appears at http://127.0.0.1:54324) or Google
# (needs the redirect URI registered — see docs/ENVIRONMENT.md), create a poll,
# publish, vote from the ballot, check the present view, close, revisit as the voter.
```

## Load testing

`e2e/load/vote-burst.load.ts` is referenced by the original plan but not written this session.
When it exists: it's directional against local Docker Postgres and only means something for
PRD §13's actual pilot numbers (1,000 submissions/60s, ~500 rps results reads) once run against
a real deployed Cloudflare + production-tier Supabase project — see `docs/DEPLOYMENT.md`.

## Known local-only limitation

`wrangler pages dev` (used to test the real Cloudflare Pages Function, not the Vite dev-proxy
shortcut) has a version-specific bug that rejects the SPA `_redirects` fallback rule as a false
positive "infinite loop" and ignores it — confirmed via `npm run build --workspace apps/web`
followed by `npx vite preview`, which correctly serves `index.html` for every route including
`/p/:code` and `/dashboard`. This is a local wrangler CLI issue, not an application bug; verify
SPA routing on the real deployed Cloudflare Pages project post-deploy (checklist in
`docs/DEPLOYMENT.md`).

## Explicitly out of scope for automated testing

- Physical QR-code scanning with real iPhone/Android devices at real room distances (PRD A7) —
  a pilot/manual step per the PRD itself.
- Load testing at the PRD §13 pilot scale — needs real deployed infrastructure.
- Google OAuth's true end-to-end round trip — needs a real Google account completing consent
  interactively; the redirect-URL shape and the post-callback `returnTo` handling are
  verifiable without one, and were (see `docs/BUILD_REPORT.md`).
