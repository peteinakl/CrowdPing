# CrowdPing — Product Requirements

**Version:** 1.2 · 21 September 2026  
**Delivery:** Minimum viable product (MVP)  
**Audience:** Coding agent, developer, product owner and tester

## 1. Purpose and authority

Build CrowdPing: a mobile-first web application that lets an organiser create a single-question poll, project a large QR code and voting URL, and collect audience responses without voter registration. Show engaging percentage bars on the presentation screen and, after submission, on participants’ phones.

This is a self-contained development specification based on the original CrowdPing Word PRD and the subsequent product discussion. Where they differ, this version takes precedence for implementation. It does not claim that any implementation or production testing has already occurred.

### Changes from version 1.0

- Audience-facing results show percentage bars without vote counts or total response counts. The organiser’s private dashboard retains counts.
- Participants can see results after submitting their vote, including on a later visit from the same recognised browser.
- The voter confirmation and results screens include a subtle **Create your own CrowdPing poll →** link.
- The full-screen presentation experience explicitly prioritises the question, a very large QR code and its URL. QR and URL remain visible when results are revealed.
- Hosting is explicitly Cloudflare for the frontend and Supabase for the backend. Canonical base-URL configuration is mandatory.
- Results permissions, API boundaries and acceptance criteria now support participant access to aggregates while preserving private organiser management and individual responses.

### Confirmed requirements and implementation defaults

| Area | Requirement or default | Status |
| --- | --- | --- |
| Product | Multiple independent polls per organiser; one question and predefined choices per poll | Confirmed |
| Identity | Supabase organiser accounts with Google sign-in; voters do not register | Confirmed |
| Hosting | Cloudflare frontend; Supabase backend, database and authentication | Confirmed |
| URLs | Configurable canonical public base URL for links, QR codes and redirects | Confirmed |
| Storage | Supabase stores polls and authoritative votes | Confirmed |
| Participation | One current response per recognised browser per poll; voter can change their response while open | Confirmed |
| Presentation | Question, very large QR code, URL and revealable results | Confirmed |
| Results design | Audience sees percentages and horizontal bars, without numerical vote counts | Confirmed |
| Participant results | Results available after submitting a vote | Confirmed |
| Growth link | Small invitation to create a CrowdPing poll beneath confirmation/results | Confirmed |
| Ballot | Single choice, 2–8 answer options | Proposed implementation default |
| Publication | Question and choices become immutable on publication | Carried-forward default |
| Refresh | Fetch results every two seconds while an eligible results view is active | Proposed default; the user suggested approximately one minute as a possibility |
| Results timing | Default to showing participants results after voting; optional organiser setting to delay until closure | Proposed implementation default |
| Email sign-in | Offer email one-time codes alongside Google | Carried-forward default |
| Lifecycle | Draft → open → closed; no reopening or resetting | Carried-forward default |
| Expiry | Seven days after publication by default; configurable before publication up to 30 days | Carried-forward default |
| Retention | Delete closed polls and responses 12 months after closure; owner may delete earlier | Proposed operational default |

Implement the defaults unless the product owner supplies a replacement. Record consequential deviations rather than silently changing the product.

## 2. Product boundaries

**Organiser / publisher / poll author** means the authenticated person who creates and manages a poll. **Voter / participant** means a person opening its link and answering it. An organiser can also participate under ordinary voter rules.

Private management does not make the question confidential: anyone holding a voting link can read the published question and choices. Polls are unlisted, with no public directory or search. Other organisers cannot access the owner’s management area.

Browser recognition is not proof of personal identity. Clearing cookies or switching browser/device can permit another response. A shared browser represents one participant. Describe this as one response per browser while its cookie is retained, never verified one-person-one-vote. The MVP is for audience feedback, not high-assurance elections.

Participant results are aggregate information deliberately shared with eligible voters. Percentages can still reveal information in very small groups; do not promise statistical anonymity or secrecy merely because counts are hidden.

## 3. User journeys and stories

### Organiser journey

Visit CrowdPing → choose Create a poll → sign in → enter question and choices → select results timing and expiry → preview → publish → display/share QR → optionally reveal results in the room → close voting.

| ID | User story and required behaviour |
| --- | --- |
| O1 | Sign in using Google or an email code. Successful sign-in returns to the intended action; cancellation and expired codes have clear recovery paths. |
| O2 | View only my polls in a paginated dashboard, including status, question, response count and creation date. |
| O3 | Save/edit a draft, add/remove/reorder choices and preview the mobile ballot without recording a vote. |
| O4 | Publish after confirmation that the question and choices will lock. Receive one permanent voting URL and matching QR code. |
| O5 | Copy the URL, download the QR as SVG or PNG, and launch full-screen presentation mode. |
| O6 | Privately inspect counts, percentages and total responses; reveal/hide percentage results on the presentation screen. |
| O7 | Close voting immediately. Delete drafts or permanently delete closed polls and their responses after confirmation. An open poll must be closed first. |
| O8 | Choose whether participant results appear after voting or only after voting closes. Default to after voting. |

### Voter journey

Scan QR/open link → read question → select one answer → Submit vote → receive server-confirmed Vote recorded → see saved answer and permitted results → optionally Change my answer or Create your own CrowdPing poll.

| ID | User story and required behaviour |
| --- | --- |
| V1 | Vote without providing a name, email, account or app download. |
| V2 | Return in the same browser and recover my saved answer. |
| V3 | Change my answer while voting is open. Save change replaces the existing response; it never adds to the total. |
| V4 | See percentage results after a successful submission when permitted by the poll’s results timing. |
| V5 | Revisit the same URL after closure and see my answer and final results when my browser still identifies the recorded response. |
| V6 | See Voting has closed and no submission/change controls once the poll closes or expires. |
| V7 | Follow a small Create your own CrowdPing poll → link from confirmation/results into the organiser creation journey. |
| V8 | Receive Poll unavailable for unknown, unpublished or deleted polls without learning the owner’s identity. |

### Validation

- Question: 1–240 characters. Each choice: 1–120 characters. Single choice only; 2–8 choices.
- Trim surrounding whitespace. Reject empty or duplicate choices after Unicode normalisation and case folding.
- Support ordinary Unicode text. No HTML, rich text, images or embedded links in poll content for MVP.
- Enforce validation on server/database write paths as well as in the UI.
- Lock question, choice labels, membership and ordering at publication. Do not use client-only restrictions.
- For MVP, configure expiry and participant results timing before publication and lock these settings on publication. Presentation reveal/hide remains available while presenting.

## 4. Screens and navigation

The following paths are proposed application routes; equivalent routing is acceptable if the behaviour and access rules remain intact.

| Screen / route | Content and behaviour |
| --- | --- |
| Landing `/` | One concise explanation and prominent Create a poll action. |
| Sign-in `/sign-in` | Continue with Google and Continue with email. No profile-completion requirement. Preserve a validated internal return destination. |
| My polls `/dashboard` | Owner-only list, clear Draft/Open/Closed states and context-appropriate actions. |
| Create `/polls/new` | One-column form, numbered/reorderable choices, expiry, results timing and mobile preview. |
| Manage `/polls/{id}` | Owner-only editing for drafts; share, private results, present and close actions for published polls. |
| Present `/polls/{id}/present` | Owner-authenticated full-screen question/QR/URL view with optional percentage bars. |
| Participate `/p/{code}` | Ballot, confirmation, results and closed states at one stable URL. |

### Mobile ballot and confirmation

- Support widths from 320 px without horizontal scrolling; use a centred reading width around 560 px.
- Place full-width radio-style answer cards beneath the question. Do not preselect an answer.
- Make the Submit vote action easy to reach without obscuring choices, validation messages or keyboard focus.
- Display explicit loading, saving, saved, failed, closed and unavailable states.
- Show Vote recorded only after the server confirms persistence. Keep the selected choice on screen through recoverable errors.
- After saving, show the recorded answer, permitted results and Change my answer while open.
- In answer-editing mode, make Save change explicit. Do not send a mutation merely because someone taps another choice.
- If participant results are delayed, show **Results will be available when voting closes.**

### Full-screen presentation

Provide two presentation states:

1. **Join view, default:** prominent question, dominant QR code, human-readable URL directly beneath it. Hide results.
2. **Results view:** the question and percentage bars, alongside a still-large QR code with URL beneath it. Late arrivals must remain able to scan and join.

Requirements:

- Prioritise readability from the back of a room and a 16:9 projector/display layout.
- Generate the QR in application code from the canonical HTTPS voting URL; never use an external QR-generation service.
- Use dark modules on white, a four-module quiet zone, preserved square proportions and no logo inside the QR.
- Target at least 480 × 480 px for the QR at a 1920 × 1080 presentation viewport, including when results are shown. Validate scanning at actual room distances.
- Display the exact voting URL immediately beneath the QR in both states. Never display an organiser management URL as the voting URL.
- Use a two-column arrangement for results where space permits. Fit up to eight choices and the maximum question length without clipping, overlapping the QR or requiring horizontal scrolling. Validate smaller displays explicitly.
- Keep the logo modest and the question, QR and results dominant.
- Hide management clutter during presentation. Provide discoverable keyboard/pointer-accessible reveal/hide and exit controls without exposing the private dashboard.
- Fullscreen API support is an enhancement; the presentation route must also work in a normal browser tab.
- When closed, show Voting has closed / Final results. The QR may remain visible, but opening it must not permit further voting.
- Presentation authentication is required; do not create an unauthenticated management or presentation link.

**Reveal/hide controls only the room’s projected view.** It does not change participant results timing. Explain this distinction in the organiser UI.

### Audience results

- Use horizontal bars with answer labels and percentages, for example `42.5%`.
- Do not show per-choice vote counts or the total response count on participant or presentation screens.
- Keep answer order fixed as results change; do not reorder by popularity.
- All bars use the same 0–100% scale. Use restrained transitions and respect reduced-motion preferences.
- Compute percentages from current valid responses: `choice_count / total_responses * 100`.
- Round displayed values to one decimal place. Briefly explain that rounding may produce totals slightly different from 100%.
- With zero responses, show Waiting for responses and zero-length bars rather than NaN, division errors or a fabricated distribution.
- Refresh eligible visible results views every two seconds without reloading the page or losing focus.
- Show a last-updated time and a clear reconnecting/stale state if refreshes fail. Never imply failed refreshes are current data.
- Stop results refreshes after fetching the authoritative final closed result set.

### Invitation to create a poll

Use this exact link text: **Create your own CrowdPing poll →**

- Place it below confirmation/results on the participant’s phone, including when results are pending and on recognised-voter final results views.
- Make it visually secondary, with readable contrast and an adequate tap area. Small means unobtrusive, not inaccessible.
- Do not interrupt voting, use a modal, add a compulsory registration step or make access to results contingent on creating an account.
- Link to `/polls/new`; if unauthenticated, complete sign-in and return there. A new poll starts as an empty draft.
- Clicking the link must not reset, remove or otherwise alter the existing vote.
- This link is required on participant confirmation/results; it need not be added to the projected screen.

## 5. Brand and accessibility

Use a contemporary, restrained visual system: generous spacing, clear typography, one strong accent and strong contrast. Use UK English throughout user-facing copy.

The product owner will place this PRD and the original SVG together in the **project root**. The supplied asset is named **`CrowdPing_Logo(1).svg`**. Read the SVG from the project root; if its filename has changed, locate the CrowdPing SVG there rather than assuming an upload/scratch path. Use it as the brand source of truth; do not redraw, stretch, crop, recolour or approximate its geometry. Keep the original root-level SVG unchanged and copy it to `public/brand/crowdping-logo.svg` for frontend serving. If multiple candidate logos exist, ask which is authoritative rather than guessing. Its inspected viewBox is `113 351 1311 293`, with intrinsic dimensions 1311 × 293 and fills `#151417` and `#FD2801`. The file contains paths and a title; inspection found no embedded raster image, script or external reference. The SVG remains a separate root-level handover asset, not embedded Markdown content.

Preserve the SVG viewBox and aspect ratio. Inspect the supplied SVG before deriving colours. Remove unsafe executable/external content if present without altering appearance. Use a temporary text wordmark if the asset has not yet been supplied; do not block functional development or invent a replacement logo. Do not insert it into the QR code.

- Target WCAG 2.2 AA; use at least 16 px body text and a product target of 48 × 48 px interactive areas.
- Support keyboard navigation, visible focus, labelled controls, 200% zoom and screen readers.
- Selection, errors and poll state must not rely on colour alone.
- Provide semantic textual equivalents for chart labels and percentages.
- Announce vote-save success/errors accessibly without repeatedly announcing every chart update.
- Keep motion subtle and respect reduced-motion settings.

## 6. Technology stack

| Layer | Recommended implementation | Purpose |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite on Cloudflare Pages | Static application and client-side routing |
| UI | Tailwind CSS plus accessible component primitives | Consistent forms, spacing, typography and focus states |
| Database | Supabase managed PostgreSQL | Authoritative polls, choices, votes, constraints and transactions |
| Organiser identity | Supabase Auth: Google OAuth and email one-time codes | Account access; request basic Google identity scopes only, no Gmail access |
| Backend | Supabase Edge Functions and restricted PostgreSQL functions | Session verification, voter cookies, policy enforcement and atomic writes |
| API transport | Minimal Cloudflare Pages Function for `/api/*` | Fixed-upstream forwarding to Supabase; no poll business logic or data storage |
| Live results | Purpose-built aggregate APIs polled every two seconds | Private organiser and authorised participant result views |
| QR | Maintained application QR library with SVG/PNG output | Deterministic QR generation without a third-party service |
| Hosting | Cloudflare Pages frontend; Supabase backend | HTTPS application delivery, backend functions and database |
| Email | Production SMTP configured for Supabase Auth | Reliable one-time-code delivery |
| Verification | Playwright, SQL integration tests and load testing | User journeys, access boundaries and concurrency |

Pin maintained dependency versions at implementation time and verify current official documentation. Cloudflare and Supabase are fixed platform requirements. The domain and production credentials are deployment inputs, not invented values. React/Vite is the proposed frontend choice for this separation; this supersedes the original Next.js server-layer recommendation. Supabase Realtime is a later optimisation if measurements justify it; polling is sufficient for the specified MVP behaviour, subject to load validation.

### Deployment boundary

All poll logic, authorisation, vote identity, aggregation and database access run in Supabase Edge Functions/PostgreSQL. Cloudflare serves the frontend and forwards `/api/*` to a fixed, configured Supabase function upstream. This thin proxy is transport infrastructure; it does not implement a second application backend. Pages Functions provide the required request-handling runtime. [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)

The browser calls relative `/api/...` URLs so the voter credential remains first-party and HttpOnly. Forward the required cookie, content-type, Origin and organiser Authorization headers; return Set-Cookie and no-store headers correctly. Supabase emits host-only cookies with no Supabase Domain attribute. Never add a service-role credential to proxied browser requests. The proxy must have a fixed upstream, bounded request sizes/timeouts and no arbitrary URL forwarding; it must not log cookies or tokens.

Use separate Supabase function routes for anonymous voter access and authenticated organiser operations. Voter handlers must accept callers without a Supabase user JWT, then enforce this PRD’s signed browser credential and poll-specific rules themselves. Organiser handlers verify Supabase user JWTs and ownership. A public/publishable key is not voter identity. Supabase documents distinct public and user-authenticated function patterns. [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)

Validate mutation origins against configured frontend origins in Supabase, including on direct upstream requests. Do not rely on CORS or the Cloudflare proxy as the only authorisation boundary. Keep privileged database clients separate from owner-scoped clients; Supabase secrets and voter signing/HMAC keys stay in Supabase backend secrets.

Configure frontend deep-link fallback so directly loading `/p/{code}`, `/dashboard`, `/auth/callback` and presentation paths loads the application. `/api/*` must route to the proxy and must never fall back to HTML. A static frontend deployment without the API forwarding function is incomplete.

### Canonical base URL and environments

Define one canonical public application origin per environment. The production domain is still to be supplied; examples below are placeholders. Do not derive share URLs from an untrusted Host header, arbitrary `window.location.origin`, the Supabase project URL or a deployment-preview hostname.

| Configuration | Exposure/location | Purpose |
| --- | --- | --- |
| `APP_BASE_URL` | Authoritative deployment setting; mirror into Supabase function environment | Canonical application origin, e.g. `https://polls.example.com`; not secret |
| `VITE_APP_BASE_URL` | Public frontend build setting derived from the same deployment value | Frontend URL creation; must equal `APP_BASE_URL` for that environment |
| `VITE_SUPABASE_URL` | Public frontend setting | Corresponding Supabase project URL for organiser Auth |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public frontend setting | Publishable client key only; never a secret/service-role key |
| `SUPABASE_FUNCTIONS_BASE_URL` | Cloudflare proxy configuration | Fixed HTTPS function upstream for that environment |
| `ALLOWED_APP_ORIGINS` | Supabase backend configuration | Exact allowed frontend origins for mutation-origin checks |
| Voter signing/HMAC keys and privileged database credentials | Supabase secrets only | Backend credential validation and restricted data operations |

Variable names are the proposed application contract; map platform-provided Supabase environment variables where appropriate. Validate configuration at build/deployment/startup and fail with a clear error if required settings are absent or inconsistent. With Vite build-time configuration, a changed frontend base URL requires a rebuild/redeployment.

URL rules:

1. For MVP, host at the domain root. Require an absolute HTTPS origin without user info, query, fragment or path prefix; allow HTTP only for explicitly configured localhost development. Normalise a trailing slash once.
2. Use one shared URL builder, equivalent to `new URL('/p/' + validatedCode, APP_BASE_URL).href`, for copied links, the on-screen URL and SVG/PNG QR targets. All three must match exactly.
3. Use the configured base URL for absolute Create a poll links, auth callback destinations and any app links in emails. Internal application navigation and browser API calls may remain relative.
4. Set Supabase Auth Site URL and allowed redirect destinations for the correct environment, including `${APP_BASE_URL}/auth/callback`. Use a narrow production redirect allowlist. Supabase requires requested redirect destinations to match its configured allowlist. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
5. Distinguish the Google-provider callback URL supplied by Supabase from the frontend post-auth callback. Configure each in the correct console; they are not interchangeable.
6. Use separate production and non-production Supabase projects. Configure a stable staging origin for sharable test polls; ephemeral previews use their explicitly allowed non-production origin/project and must never write production votes or generate production poll links.
7. Redirect production aliases to the canonical host before issuing a voter cookie. Preserve the path and legitimate query parameters, with no open-redirect parameter. Do not redirect staging to production.
8. Treat domain changes as migrations: retain redirects for old printed QR links, update Auth allowlists and configuration, and test end-to-end. Host-only cookies do not transfer across domains, so changing the canonical host can break vote recognition; prefer to retain the host during active polls.

Local development must mirror the `/api` proxy and cookie behaviour, using local HTTPS where practical. Document any localhost-only cookie adjustment and prevent it from entering production.

## 7. Data model

| Entity | Fields and constraints |
| --- | --- |
| `auth.users` | Supabase-managed organiser identity. No registered voter account required. |
| `polls` | `id UUID PK`, `owner_id FK auth.users`, `public_code UNIQUE NULL until published`, `question`, `status` (`draft`, `open`, `closed`), `participant_results_mode` (`after_vote`, `after_close`), `created_at`, `published_at`, `closes_at`, `closed_at` |
| `poll_options` | `id UUID PK`, `poll_id FK`, `label`, `position`; unique `(poll_id, position)` and unique `(poll_id, id)` |
| `votes` | `poll_id`, `voter_key_hash`, `option_id`, `revision`, `created_at`, `updated_at`; primary key `(poll_id, voter_key_hash)`; composite foreign key `(poll_id, option_id)` → `poll_options(poll_id, id)` |

- Index `polls(owner_id, created_at)`, `poll_options(poll_id, position)` and `votes(poll_id, option_id)`.
- Store UTC timestamps; display organiser dates in their local timezone.
- Cascade permanent poll deletion through choices and responses.
- Store each browser’s current response, not a vote-history stream.
- Generate public codes using 16 cryptographically random base32 characters (80 bits), with an unambiguous 32-character alphabet. Enforce uniqueness and regenerate on collision.
- Readability grouping is acceptable, but the displayed URL, QR target and route normalisation must agree. Do not use sequential IDs or encode owner information.

## 8. Access and results eligibility

| Actor | Permitted | Denied |
| --- | --- | --- |
| Link holder without recorded vote | Read published question, choices and effective status; establish credential and vote while open | Aggregates, other responses, owner identity, poll discovery and management |
| Recognised participant with recorded vote | Read own saved answer; change it while open; read permitted percentage aggregates | Raw response rows, credentials, owner details and all management actions |
| Poll owner | Manage own poll; read private aggregate counts and percentages; present, close and delete as permitted | Edit published questions/choices; inspect voter credentials; selectively alter individual votes |
| Another organiser | Manage own polls; participate in another poll under ordinary voter rules | Another owner’s dashboard, drafts, private counts and management actions |

Participant results eligibility must be enforced on the server:

1. The poll is published and exists.
2. The supplied browser credential is valid and has a recorded response for this poll.
3. Either `participant_results_mode = after_vote`, or the poll is effectively closed.

For the default `after_vote` mode, successful participants see live results while open and final results after closure. For `after_close`, they see a pending message until closure and then final results. The presentation reveal/hide toggle does not alter these rules.

An unrecognised browser opening a closed poll sees Voting has closed, without participant results. Losing the cookie loses the ability to retrieve the saved answer and participant results; no identity-recovery mechanism is included in MVP.

Enable row-level security on exposed tables and deny access by default. Owner operations use the validated organiser JWT and owner-scoped policies through the poll relationship. Do not trust an `owner_id` supplied by the client.

Deny direct browser access to votes and public table-wide reads of polls. Public routes call only purpose-built server operations. Keep Supabase secret/service-role credentials exclusively on the server; they can bypass RLS and must never be used for arbitrary client-directed queries.

Restrict database functions for publication, closure and voting. For any `SECURITY DEFINER` function, set an empty `search_path`, qualify object names and revoke default execution grants. Enforce state transitions and published-content immutability in database functions/triggers. UI filtering is not access control.

## 9. API contracts

The routes below are browser-facing URLs on the Cloudflare application origin. The thin `/api/*` proxy maps them to Supabase Edge Functions; implement the business handlers there. Equivalent typed route mappings are acceptable.

| Method and route | Behaviour |
| --- | --- |
| `GET /api/polls/{code}` | Published question, ordered choices, effective status and participant results mode; no owner identity or counts |
| `POST /api/polls/{code}/session` | Establish/reuse browser credential; no vote mutation |
| `GET /api/polls/{code}/my-vote` | Only this credential’s saved answer and revision, or no recorded vote |
| `PUT /api/polls/{code}/my-vote` | Submit/change using `option_id` and `expected_revision`; return committed saved answer and revision |
| `GET /api/polls/{code}/results` | Enforce recorded-voter eligibility; return percentages and effective state or a typed pending/forbidden response |
| `GET /api/organiser/polls/{id}/results` | Owner-only counts, percentages, total responses and effective state |
| Organiser mutation routes | Owner-scoped draft creation/edit, publish, close and delete |

Participant results include ordered option identifiers and percentages, `status`, `is_final` and a server timestamp. Do not include raw counts, total responses, voter hashes, response rows or owner identity. Publicly displaying percentages does not make this an unauthenticated aggregate endpoint.

Use typed errors for validation failures, unavailable polls, closed voting, revision conflicts, unauthorised access and rate limits. Do not leak existence or owner details through management errors. Mark personalised/session/private result responses `Cache-Control: no-store` and prevent CDN caching across users.

Protect mutations with same-origin/CSRF controls. Never mutate votes through GET requests. Validate authentication return destinations to prevent open redirects.

## 10. Browser credential and atomic voting

### Credential

Issue a cryptographically random 256-bit secret authenticated with a server signature in a first-party, host-only, `HttpOnly`, `Secure`, `SameSite=Lax` cookie with `Path=/`. Proposed lifetime: 90 days. Never place it in a URL or localStorage.

Derive a poll-specific `voter_key_hash` on the server using HMAC over the poll ID and credential secret. Store only the derived value in the response table. Keep signing/derivation keys secret and plan rotation without invalidating active ballots. Do not expose hashes to organisers or reuse them for analytics.

Establish and round-trip the cookie before enabling submission. If cookies are blocked, explain the issue; do not silently accept untrackable repeated votes. Reuse valid credentials on refresh and coordinate initialisation across tabs where possible.

### Submission transaction

1. Client sends `option_id` and `expected_revision`: zero for a first vote, otherwise the saved revision.
2. Server derives voter identity from the verified cookie, never from a client-provided voter identifier.
3. Database transaction locks the poll, checks publication/open state and current database time against `closes_at`, and validates that the selected option belongs to it.
4. For a new response, insert revision 1. The unique poll/credential key prevents duplicate rows.
5. For an existing response, selecting the already-saved option is a successful no-op. A different option updates the row and increments revision only if `expected_revision` matches.
6. For a revision conflict, return the current saved answer and ask the client to reconfirm the change. An old delayed request must not overwrite a newer confirmed answer.
7. Commit before returning success. Changing A to B reduces A by one, increases B by one and leaves total responses unchanged.

### Failure and closure

- A submission timeout means the result is unknown. Fetch `my-vote` before retrying. Preserve the selected answer and never clear the credential as an error-recovery technique.
- Closing and voting acquire the same poll lock so their order is deterministic. Check current database time after acquiring the lock; do not rely on a transaction-start timestamp that may predate a long wait.
- Expiry correctness must not depend on a scheduled job. Every write rejects an effectively expired poll, and metadata/results use the same effective-closure rule.
- Closed polls cannot reopen or reset. A subsequent event requires a new poll and URL.

## 11. Results refresh and consistency

- Calculate counts, total and percentages from one coherent database snapshot, including zero-vote choices.
- Obtain final status and aggregates consistently with closure. A response labelled final must include every vote committed before closure; do not label an older open snapshot as final.
- Fetch immediately on entering an eligible results view, then every two seconds while visible. Avoid overlapping requests and discard stale out-of-order responses.
- Refresh after a confirmed vote/change. The server remains authoritative; do not fabricate success or definitive results from optimistic client increments.
- Pause periodic fetching in hidden tabs. On visibility restoration, reconnect or network recovery, refresh immediately.
- Use bounded retry backoff with jitter on failures, retain last confirmed bars and mark them stale.
- Waiting participants in `after_close` mode may check lightweight status every two seconds while visible; fetch results once closure makes them eligible.
- After fetching final results, stop periodic updates. Returning to a final-results page still checks that the poll exists and access remains valid.
- The original owner-only polling design now includes eligible voter screens. Measure this additional read load and use indexed queries and load-tested aggregate computation. Any internal cache must preserve eligibility checks, freshness targets and final-result correctness.
- If later moving to Supabase Realtime, use properly authorised channels carrying aggregates/invalidation signals, never raw votes. This is not required for MVP.

## 12. Privacy, abuse and operations

- No public poll directory, sequential discovery route or public organiser lookup.
- Use noindex headers and `Referrer-Policy: no-referrer`; avoid embedding poll content in social previews. These controls reduce accidental discovery but do not prevent sharing.
- Apply distributed limits to poll creation, session issuance, vote writes and result reads. Polling limits must accommodate the specified refresh interval.
- Initial vote-write limit: 10 mutations per minute per poll/browser credential, tuned through pilots. Use IP thresholds only as secondary burst protection because many venue users may share one public IP.
- Return a clear retry time. Do not let one attacker exhaust a global limit that blocks an entire event.
- Provide an abuse-report route and a way for an operator to disable reported polls. Add challenges only when justified, not a CAPTCHA on every ordinary vote.
- Keep development and production Supabase projects separate. Use version-controlled migrations, monitored authentication email and documented secret rotation.
- Monitor failed vote writes and stale results. Configure backups and complete a restore exercise before launch.
- Do not log credentials, tokens, raw voting URLs, question text or answer selections in application telemetry.
- Minimal analytics may record lifecycle events such as draft creation, publication, first response and closure plus aggregate latency/error rates. No advertising trackers in MVP.
- Proposed retention: delete polls and responses 12 months after effective closure; remove operational logs after 30 days. Document configured backup retention and account-deletion behaviour before launch.
- Returning-result access lasts only while the poll is retained and the browser credential remains available. Earlier organiser deletion makes the link unavailable.

## 13. Acceptance criteria

These are release requirements unless explicitly marked as pilot targets.

| ID | Scenario | Pass condition |
| --- | --- | --- |
| A1 | Account isolation | Owner A cannot read/change owner B’s drafts, private results or management data by changing IDs, calling APIs or querying exposed database interfaces. |
| A2 | Publication | Draft edits work. Published question/choice edits, reordering and illegal lifecycle transitions fail through all exposed write paths. |
| A3 | First vote/revisit | A new browser saves one response, sees confirmed state and recovers the same answer on reload. |
| A4 | Changes/retries | Changing A to B keeps the total unchanged. Double taps, retries and concurrent writes create no duplicates. Stale revisions cannot overwrite newer answers. |
| A5 | Boundaries | Foreign-poll options fail. Closed, expired, draft and deleted polls reject votes. Close-versus-submit follows deterministic transaction order. |
| A6 | Presentation | Question, large QR and exact URL are present in join/results states. Controls can be hidden; fullscreen has a normal-tab fallback. |
| A7 | QR | Real iPhone and Android devices scan the projected code at representative room distances. SVG/PNG downloads resolve to the same ballot. |
| A8 | Audience chart | Participant/projected views show bars and percentages only, preserve option order, handle zero responses and contain no numerical vote counts. |
| A9 | Private counts | Owner dashboard retains accurate counts, percentages and totals without exposing individual voter records. |
| A10 | Participant access | A recorded voter sees default live results; an unvoted browser cannot fetch aggregates directly. `after_close` denies results until effective closure. |
| A11 | Final results | A recognised voter revisiting after closure sees their answer and final percentages. Changes are disabled; refreshes stop only after final data is fetched. |
| A12 | Timing independence | Presentation reveal/hide does not change participant result permissions. |
| A13 | Invitation | Creation link appears below confirmation/results, survives pending/closed states for recognised voters, opens creation and preserves the original vote. |
| A14 | Network failure | Slow/disconnected submissions preserve selection and resolve actual saved state. Failed chart refreshes visibly show stale data and recover without reload. |
| A15 | Accessibility | Keyboard/screen-reader checks pass; 320 px mobile layouts and 200% zoom work; reduced motion is honoured. |
| A16 | Privacy | APIs, caches, telemetry and any channels reveal no voter credentials, other individual responses or owner identity to link holders. Participant results omit counts. |
| A17 | Expiry/rounding | All routes agree on effective closure; zero/rounded percentages are consistent, and a final snapshot includes all committed eligible responses. |
| A18 | Brand | Supplied SVG is used without distortion or reconstruction; it is absent from the QR. |
| A19 | Canonical URLs | Copied, displayed and downloaded QR links match the configured frontend base URL; no Supabase, localhost or preview hostname leaks into production links. |
| A20 | Deployment routing | Cloudflare deep links load correctly; API requests reach Supabase and return JSON/cookies, not SPA HTML. Voter recognition works on real deployed browsers. |
| A21 | Environment/auth | Production and staging use their own origins/projects; Google/email sign-in returns to the correct application and intended internal action. Forged origins and redirect targets are rejected. |
| A22 | Configuration | Missing/invalid base URLs fail clearly. Production aliases canonicalise before cookie issuance; frontend bundles contain no secret/service-role credentials. |

### Proposed pilot load and speed targets

- Test 1,000 submissions over 60 seconds to one poll, including a burst of 100 concurrent writes, and ten such polls in parallel.
- Include up to 1,000 visible participant result sessions per poll refreshing every two seconds plus organiser/presentation traffic. That implies approximately 500 participant result requests per second per fully active poll, before overhead; do not test write load alone.
- No lost or duplicate responses; eligible-request success at least 99.5% under the declared test workload.
- p95 vote acknowledgement at most 1.5 seconds; p95 results freshness at most 5 seconds under that workload.
- Target voter-page LCP at most 2.5 seconds on representative mid-range mobile/4G.
- These are targets to validate on the chosen hosting/Supabase configuration, not capacity guarantees. Report achieved capacity, read load and bottlenecks; do not silently reduce tests or claim an untested event size.

## 14. Build sequence and handover

1. **Foundation:** project, environments, organiser auth, schema/migrations and owner policies. Prove isolation before public voting.
2. **Core poll:** drafts, validation, preview, publication, QR/downloads, credential establishment and atomic mobile voting. Test race conditions and retries.
3. **Event experience:** join/results presentation states, private counts, participant percentage results, eligibility checks, creation link, expiry and closure.
4. **Quality:** accessibility, SVG integration, physical QR testing, degraded networking, security boundaries, load and refresh testing.
5. **Pilot:** three to five facilitated events. Observe create-to-publish time, scan-to-vote completion, confusion and repeat-use intent.

The coding agent must deliver:

- Working source code with clear setup/run instructions and pinned dependencies.
- Supabase SQL migrations, constraints, RLS policies and restricted functions; no manual-only schema changes.
- An example environment file with variable names/placeholders and no real secrets.
- Cloudflare Pages build/deployment and API-proxy configuration, Supabase Edge Functions deployment instructions and SQL migrations.
- An environment matrix and instructions for Google OAuth, email codes/SMTP, callback URLs, canonical base URL, Supabase projects and production domain.
- Automated tests for material acceptance criteria and instructions for running them; explicitly list physical-device/manual checks still outstanding.
- A build/test report with actual results, any failures, load measurements and known limitations.
- A README explaining browser-based vote limitations, result eligibility, deployment configuration, retention and operational tasks.

Use real Supabase-backed flows for acceptance, not hard-coded mock totals. Demo seed data may be supplied separately. If credentials or deployment inputs are missing, complete the code and configuration guidance and state exactly what remains unverified. Never claim that a deployed or tested production service exists without evidence.

### Product validation targets

- At least four of five first-time organisers publish without help.
- Median creation-to-publication time under two minutes, excluding sign-in.
- At least 90% of observed pilot voters complete without assistance.
- Track returning organisers over 30 days and ask whether they would use CrowdPing at their next event.

These are proposed pilot hypotheses, not established benchmarks.

## 15. Out of scope

Multi-question surveys, multiple-selection ballots, ranked voting, free-text answers, quizzes, word clouds, live Q&A, teams, billing, integrations, AI-generated questions, identifiable voter records and verified one-person-one-vote are excluded.

CSV export and poll duplication are follow-ups. Duplication must create a fresh draft, URL and empty result set. No reopening/resetting published polls. Do not add pricing or a broader survey engine before validating repeat use.

## 16. Inputs and reference documentation

The SVG logo has been supplied and inspected. Remaining implementation inputs: production domain (the value of `APP_BASE_URL`), Cloudflare project/account configuration, Supabase project configuration and authorised production credentials. Hosting is Cloudflare for the frontend and Supabase for the backend. Name/domain/trade-mark availability was not validated by this PRD.

Cloudflare Pages Functions, Supabase Edge Function authentication and Supabase redirect configuration were checked for this revision. Other references carry forward from the original PRD. The coding agent should verify current APIs and deployment details at implementation time.

- [Supabase: Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase: passwordless email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase: custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase: row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: database functions](https://supabase.com/docs/guides/database/functions)
- [Cloudflare: Vite on Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)
- [Cloudflare: Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Supabase: Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase: Auth redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Supabase: Realtime authorisation](https://supabase.com/docs/guides/realtime/authorization)
- [MDN: using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)
