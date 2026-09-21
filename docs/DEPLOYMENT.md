# Deployment

This is a runbook for taking CrowdPing from "code + a provisioned staging Supabase project"
(the current state — see `docs/ENVIRONMENT.md`) to a real deployed instance. None of the steps
below have been performed yet; they need credentials/access this build session didn't have
(a Cloudflare account, a production domain, SMTP credentials).

## 1. Supabase: finish staging, or provision production

Pick one project (staging is already provisioned — `sjddczimxefzmvimjqwu`) or create a fresh
production project the same way (`mcp__supabase__create_project`, or Dashboard → New Project).
**Never reuse one project across staging and production** (PRD §6).

For whichever project you're deploying:

1. Set Edge Function secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set`
   with a personal access token): `ALLOWED_APP_ORIGINS`, `VOTER_COOKIE_SIGNING_KEYS`,
   `VOTER_KEY_DERIVATION_KEY`, `COOKIE_SECURE=true`. Generate fresh random values — see
   `docs/ENVIRONMENT.md`.
2. Dashboard → Authentication → URL Configuration: Site URL = your frontend's canonical origin;
   Redirect URLs includes `<origin>/auth/callback`.
3. Dashboard → Authentication → Sign In / Providers → Google: enable, paste the Client
   ID/Secret, and confirm `https://<project-ref>.supabase.co/auth/v1/callback` is in the Google
   Cloud Console OAuth client's Authorized redirect URIs.
4. Dashboard → Authentication → Emails → SMTP Settings: configure a real provider. Do not launch
   on the default Supabase email sender — it's rate-limited and not meant for production volume.
5. If migrations/functions aren't already pushed to this project (staging already has them):
   `supabase link --project-ref <ref>` then `supabase db push` and
   `supabase functions deploy voter-api organiser-api`, or push via the same MCP tools used
   during the build (`apply_migration` per file, `deploy_edge_function` per function — see git
   history for the exact calls).
6. Run `mcp__supabase__get_advisors` (or Dashboard → Advisors) after any schema change and
   confirm no new ERROR-level findings, particularly around RLS and function grants — see
   `docs/DEVIATIONS.md` for why this matters here specifically (a real vulnerability was found
   and fixed this way during the build).

## 2. Cloudflare: Worker with static assets

Deployed as a Worker with a static-assets binding (`apps/web/worker.ts` + `apps/web/wrangler.toml`),
not classic Cloudflare Pages. This is a mid-build switch — see `docs/DEVIATIONS.md` for why: the
project was originally connected as a Git-integrated Pages project (`wrangler pages deploy`), but
its deploy step kept failing with a Pages-Projects-API authentication error (code 10000) regardless
of how the `CLOUDFLARE_API_TOKEN` was scoped. Switching the deploy command to plain `wrangler
deploy` — which only needs the much more commonly-granted "Workers Scripts: Edit" permission —
resolved it. Functionally equivalent: `worker.ts`'s `fetch` handler proxies `/api/*` exactly like
the old `functions/api/[[path]].ts` Pages Function did (ported verbatim), and falls through to
`env.ASSETS.fetch(request)` for everything else, with SPA deep-link fallback handled by
`wrangler.toml`'s `[assets] not_found_handling = "single-page-application"` (the old
`public/_redirects` rule is gone — Cloudflare's asset engine now flags it as a redundant/looping
rule alongside that config key, and rejects it).

1. In the Cloudflare dashboard, on the connected Git project's **Settings → Build**: Root directory
   = `apps/web`, Build command = `npm run build`, **Deploy command = `npx wrangler deploy`** (not
   `wrangler pages deploy` — that targets the old Pages Projects API and will fail/warn on this
   project's current config).
2. `CLOUDFLARE_API_TOKEN` (project's Environment variables, used by the deploy command itself):
   a token scoped with at least "Workers Scripts: Edit" — the dashboard's "Edit Cloudflare
   Workers" token template covers this.
3. Environment variables for the app itself (also project Environment variables, not
   `wrangler.toml`'s `[vars]` — those are local-dev-only defaults): `APP_BASE_URL`,
   `VITE_APP_BASE_URL` (same value), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_FUNCTIONS_BASE_URL` (`https://<project-ref>.supabase.co/functions/v1`),
   `ALLOWED_APP_ORIGINS` (your deployed domain).
4. Bind the production domain (project → Custom domains/Triggers). Until a real domain exists,
   the `*.workers.dev` subdomain Cloudflare assigns works for staging verification.
5. Deploy, then confirm:
   - `/`, `/dashboard`, `/p/<code>`, `/polls/<id>/present` all load the SPA (deep-link fallback
     via `not_found_handling`).
   - `/api/polls/doesnotexist` returns a JSON 404, not HTML.
   - `curl -I` on any `/api/*` route shows `Cache-Control: no-store`.
6. Local dev/testing of this exact worker (not just `vite dev`): `cd apps/web && npm run build &&
   npx wrangler dev --port 8788` — serves the built `dist/` plus the real proxy, both verified
   locally (SPA fallback, `/api/*` 404 shape, `Cache-Control: no-store`) before this doc was
   written. Note this serves the last `npm run build` output, not live-reloading source — use
   plain `vite dev` at `:5173` for routine frontend iteration instead.

## 3. DNS / domain migration (if changing hosts later)

PRD §6 rule 8: treat domain changes as migrations. Retain redirects for old printed QR links,
update Supabase Auth allowlists and `ALLOWED_APP_ORIGINS`, and test end-to-end before retiring
the old host. Host-only voter cookies do not transfer across domains — changing the canonical
host mid-event breaks vote recognition for anyone who already voted, so avoid it while a poll is
open.

## 4. Post-deploy verification checklist

- [ ] Organiser journey: sign in (both Google and email) → create → publish → present → close,
      on the real deployed origin.
- [ ] Voter journey: scan the *actual projected QR* with a real phone at a real room distance
      (PRD A7 — this cannot be verified any other way; do it before the first real event).
- [ ] `docs/BUILD_REPORT.md`'s deferred-items table — work through it and check off what's now
      done.
- [ ] Run `e2e/load/vote-burst.load.ts` against this real deployment (not just local Docker
      Postgres) if you want the PRD §13 pilot numbers to mean anything.
- [ ] Confirm backup configuration for the production Supabase project and complete one restore
      exercise (PRD §12) before the first real event.

## Operator runbook: disabling an abusive poll

No admin UI exists for MVP (PRD §4's screen list has none). To disable a reported poll, an
operator (a row in `public.operators`) calls `disable_poll(poll_id, reason)` — via the
Supabase SQL editor or a signed-in session with operator privileges, not via any app route.

To grant operator access to a user:

```sql
insert into public.operators (user_id)
values ('<the organiser''s auth.users.id>');
```
