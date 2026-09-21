# Deviations from the PRD

`CrowdPing_Product_Requirements.md` states it takes precedence over any other guidance and
that "consequential deviations" must be recorded rather than made silently. This file is that
record. Everything below preserves the PRD's stated behaviour and security properties; nothing
here changes what an organiser or voter can do — with one explicit exception, recorded first.

## Explicit product decision: logo embedded in the QR code

PRD §4 ("no logo inside the QR") and §5 ("Do not insert it into the QR code") both explicitly
prohibit this. The product owner asked for it directly in this session, after being told the
prohibition and the real trade-off (embedding anything increases scan-failure risk, which is
exactly what the PRD's own QR requirements — legibility at room distance, A7's real-device scan
check — exist to protect), and confirmed they wanted it anyway. This is the one deliberate,
explicit override in this file; everything else below is either an implementation detail the
PRD left open or a bug fix.

**Mitigation applied, not skipped:** `apps/web/src/lib/qr.ts` raises `errorCorrectionLevel` from
`M` to `H` (~30% redundancy budget) specifically to accommodate this. The logo (the real
`public/brand/crowdping-logo.svg` asset, fetched and embedded as-is — never redrawn) is sized to
25% of the QR's width with a solid white backing rect. The header logo was removed from the
presentation join screen at the same time (also requested) so the brand mark isn't duplicated on
that screen.

**Sizing was corrected after decode testing, not just area math.** The initial implementation
sized the logo to 35% of the QR's width based on a raw area calculation (~2.7% of the QR's total
area, "far inside" H-level's redundancy budget) and was signed off as "verified" from a single
manual scan of one poll URL. That was a non-representative test: a follow-up automated check
(`jsQR` decoding real `canvas`/browser-rendered output, both the on-screen SVG path and the
downloadable PNG path) found 35% reliably fails to decode for some poll codes while passing for
others — area-percentage math doesn't predict real decodability because module placement is
payload-dependent. `LOGO_WIDTH_FRACTION` was reduced to 25%, then re-verified: 0 failures across
40+ real decode attempts (2 known-bad payloads plus 38 random poll codes) covering both the live
`toSvgString` render path and the `toPngDataUrl` download path, run in an actual browser (not a
Node approximation). 25% still has margin above the observed failure point (35% failed, 30%
passed cleanly) — see the comment above `LOGO_WIDTH_FRACTION` in `qr.ts` before raising it again,
and re-run a real decode test (not just area math) if you do.

**Still genuinely unverified:** real-device scanning at actual room distance (PRD's own A7
check) hasn't been performed for this logo'd configuration — do this before relying on it at a
real event, and revert to a plain code (`errorCorrectionLevel: 'M'`, no overlay) if scan
reliability turns out to be a problem in practice.

## Schema: additive columns beyond the §7 table

PRD §7 lists `polls`, `poll_options`, `votes` with a specific column set. Four additions were
necessary to implement requirements stated elsewhere in the PRD that §7's table simply didn't
enumerate:

| Column | Why |
| --- | --- |
| `polls.expiry_days` | §1/§3 require the organiser to configure expiry *before publication*; §7 only lists `closes_at`, which is computed at publish time as `published_at + expiry_days`. |
| `polls.response_count` | Backs O2's dashboard "response count" and the results functions' total, without ever exposing raw `votes` rows to a count query from a non-owner context. Maintained by a single `AFTER INSERT` trigger — see "Voting transaction" below. |
| `polls.disabled_at`, `polls.disabled_reason` | §12 requires "a way for an operator to disable a reported poll"; §7's table has no such field. |
| `operators(user_id)` | Minimal allowlist so `disable_poll`/`enable_poll` can check membership. §4's screen list has no admin UI, so adding an operator is a runbook step (`docs/DEPLOYMENT.md`), not a new screen. |

## Voter identity: keyed by `public_code`, not `poll_id`

PRD §10 describes `voter_key_hash` as derived from the poll's identity and the voter secret,
in context alongside `poll_id`-based wording elsewhere. The implementation uses the poll's
`public_code` as the per-poll domain separator instead of its internal UUID:
`voter_key_hash = HMAC-SHA256(derivation_key, public_code || secret)`.

Both are unique and immutable once a poll is published (a code is only assigned at publish
time and never changes), so the security property — a vote on poll A can never be replayed as
a vote on poll B — is identical either way. The practical benefit: every voter-facing route
already receives the public code from the URL, so voter-api never needs a separate lookup
round-trip to resolve an internal ID before it can compute the hash or call `submit_vote`.

## API error envelope and REVISION_CONFLICT (bug fixes, not a PRD deviation, but load-bearing enough to log)

Two integration bugs were found and fixed during end-to-end browser testing, both severe
enough to have broken core acceptance criteria (A4: "Stale revisions cannot overwrite newer
answers") had they shipped:

1. **Nested error envelope.** The Edge Functions originally returned errors as
   `{"error": {"code": ..., "message": ...}}`, but `apps/web/src/lib/apiClient.ts` reads
   `code`/`message`/`current`/`retryAfterSeconds` directly off the parsed body (matching
   `ApiErrorBody` in `types.ts`). Every `err.code` check in the frontend (revision-conflict
   recovery, closed-poll messaging) was silently reading `undefined`. Fixed by flattening
   `errorResponse()` in `supabase/functions/_shared/errors.ts` to the shape the frontend
   already expected, and adding the missing `REVISION_CONFLICT` code (it was documented in
   the SQL functions' own error-convention comment but never added to the Edge Function's
   `ErrorCode` union).
2. **Silent conflict swallowing.** `submit_vote`'s `'conflict'` status row (a normal,
   non-exception return per `voting_transaction.sql`'s own design) was being returned to the
   client as an HTTP 200 success with the *old* option/revision, rather than surfaced as a
   `REVISION_CONFLICT` error carrying `current`. A stale "change my vote" request would have
   looked like a successful save of the wrong answer instead of prompting the voter to
   reconfirm, directly contradicting PRD §10.6. Fixed in `voter-api/index.ts`'s `PUT /my-vote`
   handler.

## Security fix: voter RPCs and internal tables were reachable outside the Edge Functions

Found via `mcp__supabase__get_advisors` after the initial migration push, not by inspection —
recorded here because it's the most consequential thing in this file. Two related gaps, fixed
by migrations `20260921041717_lock_down_voter_rpc_and_internal_tables.sql` and
`20260921042434_lock_down_internal_helpers_and_default_grants.sql`:

1. **PostgREST exposes any anon/authenticated-granted `SECURITY DEFINER` function at
   `/rest/v1/rpc/<fn>`.** `submit_vote`, `get_my_vote`, `get_participant_results`, and
   `report_poll` all trust a caller-supplied `p_voter_key_hash` with no independent
   verification — voter-api's entire security model depends on *it* being the only thing that
   ever computes that hash, from a cryptographically verified signed cookie, before calling
   these functions. Because the functions were also directly callable via PostgREST using the
   public anon key (and, it turned out, by any signed-up `authenticated` user too — trivial to
   obtain via email OTP), an attacker could bypass the cookie check entirely: pass any
   fabricated 64-hex-char string as `p_voter_key_hash` to `submit_vote` and stuff unlimited
   fake ballots, or read another "voter"'s percentages by fabricating their hash. The Edge
   Function's origin check and rate limiting are also bypassed by calling PostgREST directly.

   **Fix:** `voter-api` now calls these functions using the Supabase **service-role key**
   (server-side only, inside the Edge Function — never forwarded to or reachable from the
   browser) instead of the anon key, and `anon`/`authenticated` EXECUTE was explicitly revoked
   on all five. `get_public_poll` is the one function left anon-callable: its only input is a
   poll's public code, and it returns nothing beyond what anyone holding that code is already
   meant to see (PRD §2). This does not conflict with PRD §6's "never add a service-role
   credential to proxied browser requests" — that rule is about the browser never holding or
   transmitting the key, which remains true; using it inside a server-side Edge Function is
   Supabase's own documented pattern for exactly this situation.

2. **`rate_limit_buckets`, `abuse_reports`, and `operators` were created with RLS left
   disabled entirely** (unlike `polls`/`poll_options`/`votes`, which enable RLS with zero
   policies). Supabase's cloud default (`auto_expose_new_tables`) means anon/authenticated had
   direct PostgREST table access by default — e.g. `GET /rest/v1/operators` would have listed
   which `auth.users` are operators, and `rate_limit_buckets` rows could potentially be read or
   manipulated directly. **Fix:** RLS enabled with no policies and all grants revoked, matching
   `votes`'s posture — reachable only through the `SECURITY DEFINER` functions.

3. **A second layer of the same root cause, found by directly querying
   `information_schema.role_routine_grants` rather than trusting the advisor's first pass or
   `revoke ... from public`:** every internal helper (`_normalise_choice`, `_resolve_poll_id`,
   `_validate_question_and_choices`, `effective_poll_status`, `generate_unique_public_code`)
   and trigger function (`tg_poll_options_before_change`, `tg_polls_before_update`,
   `tg_votes_after_insert`) was also directly callable by `anon` and `authenticated`, and the
   five voter functions above were *still* callable by `authenticated` even after the first
   fix revoked only `anon`. Root cause: `revoke execute on all functions in schema public from
   public` only strips the implicit PUBLIC-pseudo-role grant; it does not touch a direct
   per-role grant that Supabase's default-privilege mechanism creates at function-creation
   time. **Fix:** explicit `revoke ... from anon, authenticated` by role name on every function
   that shouldn't be directly callable. `service_role` is unaffected either way — Supabase
   grants it EXECUTE on everything by the same default-privilege mechanism, confirmed via the
   same `information_schema` query, so voter-api's service-role client needed no additional
   grant.

   **Consequence for future migrations:** any new function added later will, by the same cloud
   default, be auto-granted to `anon`/`authenticated` at creation time. A new migration that
   adds a function not meant to be directly callable must explicitly `revoke execute ... from
   anon, authenticated` — do not assume the absence of an explicit `grant` is sufficient.

Organiser functions (`create_draft_poll`, `update_draft_poll`, `publish_poll`, `close_poll`,
`delete_poll`, `get_owner_results`, `disable_poll`, `enable_poll`) were left callable by
`authenticated` (revoked from `anon`, which never needed them). This is safe by design, not an
oversight: every one of them starts with an `auth.uid()`-derived ownership check, which
resolves correctly to the real caller's identity whether the call arrives via organiser-api or
directly via PostgREST — there is no ownership bypass available either way.

**Regression this introduced, found immediately by actually testing poll creation afterward:**
`check_rate_limit`'s `authenticated` revoke broke `organiser-api`'s own `POST /polls` handler,
which rate-limits poll creation via the forwarded-JWT (`authenticated`) client — not
service-role, since organiser-api's whole design deliberately avoids the service-role key. Every
draft creation failed with a masked "Something went wrong" 500 until a follow-up migration
(`20260921044647_restore_authenticated_check_rate_limit.sql`) re-granted `authenticated`
EXECUTE on `check_rate_limit` specifically. Re-checked every other RPC call site in both Edge
Functions against the grants afterward (grep for `.rpc(` in each `index.ts`) to confirm this was
the only function organiser-api calls that had been over-revoked — it was. `check_rate_limit` is
unlike the voter-identity functions in one important way: it doesn't trust a caller-supplied
identity to bypass anything, so leaving it `authenticated`-callable risks only minor griefing
(an attacker guessing a rate-limit key to increment), not an eligibility or identity bypass.

**Lesson applied going forward:** after any grants change, actually exercise every calling path
(not just the one the fix was targeting) before considering it done — the advisor tooling
catches over-broad grants, but nothing automated catches an over-narrow one; that only surfaces
by using the feature.

## Frontend: `createDraft` accepts the full poll shape, not just question/choices

The original `apps/web/src/lib/apiClient.ts` typed `organiser.createDraft` as
`Pick<CreatePollInput, 'question' | 'choices'>`, with `PollCreatePage` following up with a
second `updateDraft` call to set `expiryDays`/`participantResultsMode`. The organiser-api's
`PATCH /polls/:id` handler treats `question`/`choices` as required on every call (matching
`update_draft_poll`'s SQL signature, which has no partial-update mode), so that follow-up call
always failed validation. Fixed by widening `createDraft` to accept `CreatePollInput` in full
and passing everything in the single `POST /polls` call, which `create_draft_poll` already
supported — this also removes a redundant network round-trip on every poll creation.

## Bundle splitting (performance, not correctness)

Initial production build was a single ~626 KB JS chunk (187 KB gzip) because
`@supabase/supabase-js` and every organiser-only page were statically imported from `App.tsx`,
reachable from the voter-only ballot route too. Given PRD §13's mobile LCP target (≤2.5s), this
was worth fixing during the build rather than deferring: organiser/auth routes and `RequireAuth`
are now `React.lazy()`-loaded, and `apiClient.ts`'s `authHeaders()` dynamically imports
`supabaseClient.ts` instead of importing it statically. The voter path's eager chunk dropped to
~329 KB (105 KB gzip); `supabase-js` now loads in its own ~227 KB chunk only when an
organiser/auth route is actually visited.

## Known tension, not resolved: rate limiting vs. results-read volume

`check_rate_limit` is a Postgres-backed fixed-window counter (a real table write per call).
PRD §12 asks for distributed limits on result reads as well as vote writes, but §13's own pilot
load implies ~500 requests/second of exactly that traffic at one fully active poll (1,000
visible participants × one request per 2-second poll interval). A per-request Postgres write at
that volume is itself a scaling risk the PRD doesn't reconcile. Current limits are set well
above the per-client rate the 2-second cadence implies, as a correctness backstop rather than a
tuned production limit; an in-Edge-Function in-memory token bucket is the documented follow-up
if load testing (deferred — see `docs/BUILD_REPORT.md`) shows contention.

## Deployment: Worker + static assets, not classic Cloudflare Pages

The original plan (and `docs/DEPLOYMENT.md`'s first draft) deployed via Cloudflare Pages:
`apps/web/functions/api/[[path]].ts` as a Pages Function, `wrangler.toml`'s
`pages_build_output_dir`, `_redirects` for SPA fallback. During actual first deployment (a
Git-connected Cloudflare project, outside this session's own access — no Cloudflare auth was
ever available here), the configured `wrangler pages deploy` deploy step failed repeatedly with
a Pages-Projects-API authentication error (code 10000), reproducible across multiple freshly
created API tokens (custom-scoped, and the dashboard's own "Edit Cloudflare Workers" template) —
the token authenticated fine for identity/whoami calls but was consistently rejected specifically
calling `/accounts/.../pages/projects/...`.

Rather than continue debugging that specific endpoint blind (each attempt cost a full CI cycle),
switched to deploying as a plain Cloudflare Worker with a static-assets binding: `apps/web/worker.ts`
(the same proxy logic from the old Pages Function, ported verbatim) + `wrangler.toml`'s `main` +
`[assets]` block, deployed via `npx wrangler deploy` instead of `wrangler pages deploy`. This only
needs the "Workers Scripts: Edit" permission — a much more reliably-granted scope than whatever
the Pages Projects API specifically required and never got. Verified locally end-to-end (`wrangler
dev`, both the SPA fallback and a real round trip through the proxy to the local Supabase
function) before pushing. `functions/api/[[path]].ts` and `public/_redirects` were deleted —
superseded, and in `_redirects`' case actively flagged by Cloudflare's asset engine as a
redundant/looping rule once `[assets].not_found_handling = "single-page-application"` is set.

One open question this doesn't resolve: whether `wrangler deploy` against a project Cloudflare's
dashboard still shows as a "Pages project" (by name) correctly updates that same resource, or
produces a second, separate Worker resource — wrangler itself warns about this
("Proceeding will likely produce unwanted results") when it detects the mismatch. Confirm which
happened after the first successful deploy, and reconcile/rename in the dashboard if it's the
latter.
