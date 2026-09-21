# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repo is pre-implementation: it currently contains only the product spec (`CrowdPing_Product_Requirements.md`), the brand asset (`CrowdPing_Logo.svg`), and MCP config (`.mcp.json` wiring up the Supabase MCP server). There is no source tree, package manifest, build, lint, or test setup yet. There are no commands to run until the project is scaffolded.

**`CrowdPing_Product_Requirements.md` is the authoritative spec.** It is versioned (currently v1.2) and explicitly states that where it differs from any other document, it takes precedence. Read the relevant section before implementing any feature — it is detailed and prescriptive (exact validation ranges, exact API contracts, exact security rules), and deviating from it silently is called out as unacceptable in the doc itself ("Record consequential deviations rather than silently changing the product"). The summary below is orientation, not a replacement for reading the source sections.

## What CrowdPing is

A mobile-first web app where an organiser creates a single-question, single-choice poll (2–8 options), gets a large QR code + short URL to project at an event, and the audience votes with no registration. Results show as percentage bars only (no vote counts) to the audience; organisers see full counts privately. It is explicitly **not** a verified one-person-one-vote system — identity is "one response per recognised browser," clearing cookies or switching devices allows re-voting, and this limitation must be reflected in UI copy, not hidden.

## Architecture (per PRD §6, §9, §10)

- **Frontend:** React + TypeScript + Vite, deployed to Cloudflare Pages. Tailwind CSS for styling.
- **Backend:** Supabase (Postgres + Auth + Edge Functions). All poll business logic — validation, publication, voting, aggregation, authorization — lives in Supabase Edge Functions / restricted Postgres functions, not in the Cloudflare layer.
- **API proxy:** A thin Cloudflare Pages Function forwards `/api/*` to a fixed Supabase Edge Function upstream. It is transport only (fixed upstream, bounded size/timeout, forwards cookies/content-type/Origin/Authorization, no logging of cookies/tokens) — it must never contain poll logic or a second backend, and must never fall back to serving SPA HTML for `/api/*` routes.
- **Two distinct auth surfaces:** anonymous voter routes (no Supabase JWT; identity comes from a signed HttpOnly browser credential) vs. authenticated organiser routes (verified Supabase user JWT + ownership checks). Don't conflate these — a publishable key is not voter identity.
- **QR generation:** always generated in application code from the canonical HTTPS voting URL; never call an external QR service, never embed the logo in the QR.

### Canonical URL discipline

There is one shared URL builder (`new URL('/p/' + code, APP_BASE_URL)`) used for the copied link, the on-screen presentation URL, and the QR target — all three must always match exactly. `APP_BASE_URL` is an explicit configured origin, never derived from `window.location.origin`, the `Host` header, the Supabase project URL, or a preview hostname. See PRD §6 "Canonical base URL and environments" for the full environment variable contract (`APP_BASE_URL`, `VITE_APP_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_FUNCTIONS_BASE_URL`, `ALLOWED_APP_ORIGINS`) before touching auth callbacks, share links, or QR code targets.

### Data model (PRD §7)

`polls` (draft/open/closed lifecycle, immutable once published) → `poll_options` (2–8, locked at publication) → `votes` (one row per `(poll_id, voter_key_hash)`, holding current state not history; changing an answer updates the existing row and bumps `revision`, it never inserts a second row). Public poll codes are 16-char base32 (80-bit) random, not sequential, and never encode owner info.

### Voting is a single atomic transaction (PRD §10)

Submit takes `option_id` + `expected_revision` (0 for first vote). Server derives the voter's identity from the verified cookie only, locks the poll row, re-checks open/expiry state against DB time (not transaction-start time), validates the option belongs to the poll, and applies optimistic-concurrency semantics on `expected_revision` (stale writes are rejected and must return the current saved answer instead of overwriting it). Any change to this flow needs to preserve: no duplicate rows, no lost updates on concurrent retries, and "closing" and "voting" racing through the same lock so their order is deterministic.

### Results visibility rules (PRD §8, §11)

Three different audiences see three different shapes of the same data, enforced server-side (not just in the UI):
- **Public link holder, no vote yet:** question + options only, no aggregates.
- **Recognised voter (has a recorded response):** own saved answer, plus percentage-only aggregates gated by the poll's `participant_results_mode` (`after_vote` = live while open + final after close; `after_close` = nothing until closed).
- **Owner:** full counts, percentages, and totals, always.

Percentage views never show raw counts or totals to non-owners, preserve a fixed option order (never sorted by popularity), round to one decimal place, and must render a defined zero-response state rather than NaN. Presentation reveal/hide is a projector-only display toggle — it never changes what a participant is allowed to fetch. Live views poll every 2 seconds (not push/websocket) with pause-on-hidden-tab and stale-state handling; Realtime is explicitly deferred, not required for MVP.

### Row-level security posture (PRD §8)

RLS is default-deny on exposed tables. Owner-scoped access goes through the poll relationship using the validated JWT, never a client-supplied `owner_id`. Any `SECURITY DEFINER` function must set an empty `search_path`, qualify object names, and have default EXECUTE revoked. Votes are never directly readable/writable by browsers — only through purpose-built functions/edge routes.

## Brand asset handling

`CrowdPing_Logo.svg` at the repo root is the brand source of truth (viewBox `-3.302 -13.235 763.905 150.899`, fills `#151417` / `#FD2801`) — do not redraw, recolour, crop, or approximate it. Keep the root copy unchanged; copy it verbatim to `apps/web/public/brand/crowdping-logo.svg` for serving whenever it's updated. If its intrinsic width/height change, also update `LOGO_ASPECT` in `apps/web/src/lib/qr.ts` and re-verify QR decodability (see that file's comments).

The PRD's "never place the logo inside the QR code" rule was explicitly overridden by the product owner during the build — the logo is deliberately embedded, with the trade-off documented in `docs/DEVIATIONS.md`. Don't revert this without being asked.

## MCP configuration

`.mcp.json` wires up the Supabase MCP server (`https://mcp.supabase.com/mcp`), enabled via `.claude/settings.local.json`. Use it for inspecting/managing the Supabase project (schema, migrations, RLS, logs, advisors) once one exists, per the tool's own usage guidance (inspect before altering schema, check advisors/logs before debugging, never run OS commands or read server files via SQL).
