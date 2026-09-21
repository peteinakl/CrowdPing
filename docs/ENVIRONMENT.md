# Environment matrix

Three environments this project cares about: **local** (Docker-based Supabase + Vite dev
server, fully working today), **staging** (a real cloud Supabase project, provisioned and
migrated — see below — but not yet reachable from a deployed frontend), and **production**
(not yet provisioned; needs a domain and a production Supabase project).

## Local development

Everything below is already working. From the repo root:

```bash
npx supabase start                       # Postgres, Auth, Storage, Studio, Inbucket/Mailpit
npx supabase functions serve --env-file supabase/.env   # voter-api + organiser-api
npm run dev --workspace apps/web          # Vite dev server on :5173, with a dev-only
                                           # /api/* proxy (vite.config.ts) mirroring the
                                           # Cloudflare Pages Function's routing rules
```

**`http://127.0.0.1:5173` (the Vite dev server) is the canonical local origin** —
`APP_BASE_URL`/`VITE_APP_BASE_URL` in `.env` and Supabase's local `site_url` all point at it.
Its `server.proxy` config (`vite.config.ts`) forwards `/api/organiser/*` and `/api/polls/*`
straight to the local Supabase Functions URL, so `npm run dev --workspace apps/web` alone gives
a fully working local app — including OAuth callbacks, share links, and QR targets — with no
`wrangler pages dev` needed for routine iteration.

This wasn't the original design (the plan called for `:8788`, matching the real Cloudflare
Pages Function's port); it was changed after `wrangler pages dev`'s local serving quirks (below)
turned a real, working Google OAuth round-trip into a 404 on the callback route. `:5173` doesn't
have that problem, and it's what's actually configured today — don't reintroduce `:8788` as the
local `APP_BASE_URL` without first confirming `wrangler pages dev` serves the SPA shell
correctly in whatever version is installed at the time.

To exercise the *actual* Cloudflare Pages Function (`apps/web/functions/api/[[path]].ts`) —
the thing that really ships — in isolation:

```bash
cd apps/web && npx wrangler pages dev http://127.0.0.1:5173 --port 8788
```

This is how the proxy's cookie/origin/header-forwarding and typed-404 behaviour were verified
(see `docs/BUILD_REPORT.md`) — `/api/*` requests through `:8788` work correctly. Two known
local-only wrinkles with this specific invocation, neither of which reflects a real production
issue:

1. `apps/web/public/_redirects`' `/* /index.html 200` SPA-fallback rule gets flagged as a false
   positive "infinite loop" and ignored (a documented wrangler bug). Non-`/api` routes served
   through `:8788` this way 404 as a result — this is exactly what produced the
   `auth/callback` 404 during the build. Verify SPA routing instead via `npm run dev` directly,
   or by building (`npm run build --workspace apps/web`) and running `npx vite preview` against
   `dist/`, which correctly serves `index.html` for every route.
2. Passing a URL as the "directory" argument (as above) makes `/api/*` work via the Pages
   Function, but does not proxy other requests through to the live Vite server the way older
   wrangler versions' docs describe — attempts to combine a static directory with `--proxy`
   (also tried during the build) hit the same _redirects issue and additionally failed to proxy
   non-static requests. Don't rely on this mode for anything beyond `/api/*` verification.

### Local environment files (both git-ignored)

- **`.env`** (repo root) — read by Vite (`vite.config.ts` sets `envDir` to the repo root) and by
  local test/dev scripts. Copy `.env.example` and fill in the real local anon/publishable key
  and service-role key that `npx supabase status -o env` prints after `supabase start`.
- **`supabase/.env`** — read by `supabase functions serve --env-file supabase/.env` for the two
  Edge Functions' own secrets: `ALLOWED_APP_ORIGINS`, `VOTER_COOKIE_SIGNING_KEYS`,
  `VOTER_KEY_DERIVATION_KEY`, `COOKIE_SECURE`, and (for local Google sign-in — see below)
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`/`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. Generate the
  signing/derivation keys with `openssl rand -base64 32`; never reuse example values.
  `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the
  Supabase platform for every Edge Function and do **not** need to be set here.

### Local Google sign-in

`supabase/config.toml`'s `[auth.external.google]` block is enabled and reads
`env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)`/`env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)` from
`supabase/.env` — neither value is ever written into a tracked file. For the button to actually
complete a sign-in (not just reach Google's consent screen), the Google Cloud Console OAuth
client must have `http://127.0.0.1:54321/auth/v1/callback` registered as an Authorized redirect
URI. `skip_nonce_check = true` is set for the local provider — this is the Supabase CLI's own
documented requirement for local Google sign-in to work at all, not a CrowdPing-specific
weakening.

### Local email sign-in

Fully testable with no external service: `supabase/config.toml` defines a custom
`[auth.email.template.magic_link]` pointing at `supabase/templates/magic_link.html`, which
renders `{{ .Token }}` (a 6-digit code) instead of Supabase's default clickable-link template —
required because the frontend's sign-in screen asks for a code, not a link. Codes land in the
local Mailpit/Inbucket inbox at `http://127.0.0.1:54324` (or via its API,
`GET http://127.0.0.1:54324/api/v1/messages`).

## Staging (cloud Supabase project — provisioned, migrations pushed, not yet load-bearing)

| Setting | Value |
| --- | --- |
| Project name | `crowdping` |
| Project ref | `sjddczimxefzmvimjqwu` |
| Region | `us-east-1` |
| Organization | AI Innovisory (`fhbmeosrbbqkjpnuwcsf`) |
| API URL | `https://sjddczimxefzmvimjqwu.supabase.co` |
| Publishable key | `sb_publishable_NJq3I6uyy-bAiPiv0jV3HA_jkfwKs_h` |

Created via the Supabase MCP server (`mcp__supabase__create_project`, free tier, $0/month
confirmed before creation). All 19 migrations and both Edge Functions (`voter-api`,
`organiser-api`) are pushed and deployed — `npx supabase migration list` locally won't show
this project (the CLI has no access token in this environment; migrations were pushed directly
via the MCP server's `apply_migration`/`deploy_edge_function` tools, which don't require
`supabase link`). Security advisors (`mcp__supabase__get_advisors`) are clean: no ERROR-level
findings, only the two expected/intentional WARN categories (see `docs/DEVIATIONS.md`).

**What's still needed before this project can actually serve real traffic:**

1. **Edge Function secrets.** `ALLOWED_APP_ORIGINS`, `VOTER_COOKIE_SIGNING_KEYS`,
   `VOTER_KEY_DERIVATION_KEY`, `COOKIE_SECURE` are not set — the MCP server exposes no
   secrets-management tool, so this needs either `supabase secrets set --project-ref
   sjddczimxefzmvimjqwu <KEY>=<VALUE>` (needs `supabase login` / a personal access token, which
   this environment doesn't have) or the Supabase Dashboard → Edge Functions → Secrets. Generate
   fresh signing/derivation keys — do not reuse the local `supabase/.env` values.
2. **Auth Site URL / Redirect URLs.** Dashboard → Authentication → URL Configuration. Set once a
   staging frontend origin exists (see Cloudflare Pages below); include
   `<origin>/auth/callback`.
3. **Google OAuth provider.** Dashboard → Authentication → Sign In / Providers → Google: paste
   the Client ID/Secret you provided, and add
   `https://sjddczimxefzmvimjqwu.supabase.co/auth/v1/callback` to the Google Cloud Console
   OAuth client's Authorized redirect URIs (already suggested to you during the build; confirm
   it's actually there).
4. **SMTP.** Default Supabase email sending is rate-limited and not meant for real usage;
   configure a real provider (Postmark, SES, etc.) under Authentication → Emails → SMTP
   Settings before relying on staging for anything beyond spot-checks.

## Production (not provisioned)

Needs, in order: a production domain (`APP_BASE_URL`), a separate production Supabase project
(never reuse staging), a Cloudflare Pages project bound to that domain, its own Google OAuth
client (or a second redirect URI added to the existing one — a shared client across
environments is acceptable if you prefer one fewer credential to manage, but keep the redirect
URI list environment-specific), and production SMTP. See `docs/DEPLOYMENT.md` for the exact
steps once those inputs exist.

## Variable reference

`.env.example` at the repo root documents every variable with inline comments. The short
version, matching PRD §6's canonical-URL contract:

| Variable | Where it's read | Notes |
| --- | --- | --- |
| `APP_BASE_URL` | Cloudflare Pages Function env | Canonical origin; must equal `VITE_APP_BASE_URL` |
| `VITE_APP_BASE_URL` | Vite build | Same value, frontend-visible |
| `VITE_SUPABASE_URL` | Vite build | Supabase project URL for Auth |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Vite build | Public key, never a secret |
| `SUPABASE_FUNCTIONS_BASE_URL` | Cloudflare Pages Function env | Fixed upstream the proxy forwards to |
| `ALLOWED_APP_ORIGINS` | Edge Function secret | Exact allowed origins, comma-separated |
| `VOTER_COOKIE_SIGNING_KEYS` | Edge Function secret | Current key first; ordered list for rotation |
| `VOTER_KEY_DERIVATION_KEY` | Edge Function secret | Separate from the signing key(s) |
| `COOKIE_SECURE` | Edge Function secret | `false` only for localhost; validated at startup |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected (Edge Functions) / test fixtures only (frontend) | Never in frontend build output |
