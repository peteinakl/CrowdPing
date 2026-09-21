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

## 2. Cloudflare Pages

1. Connect the repo (or push via `wrangler pages deploy`). Project root: `apps/web`. Build
   command: `npm run build` (run from `apps/web`, or `npm run build --workspace apps/web` from
   the repo root if Cloudflare builds from the monorepo root — set the Pages project's "Root
   directory" to `apps/web` either way, so `functions/api/[[path]].ts` is picked up as a Pages
   Function and `_redirects`/`_headers` are served from `public/`). Output directory: `dist`.
2. Environment variables (Pages project settings, not `wrangler.toml`'s `[vars]` — those are
   local-dev-only defaults): `APP_BASE_URL`, `VITE_APP_BASE_URL` (same value), `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_FUNCTIONS_BASE_URL`
   (`https://<project-ref>.supabase.co/functions/v1`), `ALLOWED_APP_ORIGINS` (your Pages domain).
3. Bind the production domain (Pages project → Custom domains). Until a real domain exists,
   the `*.pages.dev` subdomain Cloudflare assigns works for staging verification.
4. Deploy, then confirm:
   - `/`, `/dashboard`, `/p/<code>`, `/polls/<id>/present` all load the SPA (deep-link
     fallback via `_redirects`) — not the local `wrangler pages dev` false-positive case
     documented in `docs/ENVIRONMENT.md`; a real Pages deployment applies the `_redirects` rule
     correctly.
   - `/api/polls/doesnotexist` returns a JSON 404, not HTML.
   - `curl -I` on any `/api/*` route shows `Cache-Control: no-store`.
5. If step 4's SPA fallback somehow doesn't work on the real deployment either, the documented
   fallback (per Cloudflare's current Workers-assets convergence) is switching
   `apps/web/wrangler.toml` to the `assets.not_found_handling = "single-page-application"`
   config key instead of relying on `_redirects` — see the GitHub issue referenced in
   `docs/ENVIRONMENT.md`'s local-dev note before doing this, since it may not be needed.

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
