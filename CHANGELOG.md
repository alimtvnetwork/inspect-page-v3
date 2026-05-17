# Changelog

## [Extension 2.6.0] — 2026-05-17

- **Pricing card polish (Option C2/C3).** Free-plan `BillingPanel` in
  Settings now lists 4 Pro features (unlimited Smart Shares, priority
  delivery, recent-visitors drawer, email support) below the price
  tagline instead of just the lone tagline.
- **Post-checkout success toast (Option C3).** When `pollBillingUntilPro`
  flips the WP license to `active`, `BillingPanel` detects the
  free → pro transition and shows a 6-second "You're Pro 🎉" toast
  (animated, respects `prefers-reduced-motion`). Existing
  `BILLING_CHANGED_EVENT` listener already refreshes the quota row, so
  the popup updates without a manual reload.
- 181/181 vitest green. Repackaged `inspect-page.zip` + sha256.

## [Extension 2.5.10] — 2026-05-17

- **Popup sizing fix.** Chrome was sizing the popup window to whatever
  the export panel's natural content height was, which meant the new
  full-overlay Settings (and Inspect skeleton) collapsed to ~190 px tall
  and the body had a forced scrollbar after only one field. Popup
  surface now declares an explicit 380×580 footprint via inline
  `popup/index.html` styles + a `.lpe-root[data-lpe-surface="popup"]`
  rule. Floating surface keeps its content-sized height.
- Repackaged `inspect-page.zip` + sha256. 181/181 vitest green.

All notable changes to **Inspect Page** are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Extension 2.5.9] — 2026-05-17

### Fixed — Settings popover, Inspect performance, Sign-in UX

- **Settings popover layout (B1).** The popover used `max-height: 70vh`
  inside the fixed-height popup, so the bottom of the body was always
  clipped and a vertical scrollbar was always visible. Reworked to a
  full overlay (`top:40px; bottom:0`) with an internal scrollable
  body — content fits without a phantom scrollbar.
- **Dark `<select>` chevron tiling (B1).** The dark-mode `.lpe-select`
  used the `background:` shorthand which reset `background-repeat`,
  causing the chevron SVG to tile across the entire control (visible
  as a "checker pattern" on the PNG row in the screenshot). Switched
  to `background-color:` and re-asserted `background-repeat: no-repeat`
  + `background-position`.
- **Inspect tab perceived slowness (B2).** `InspectShell` started in an
  `idle` state that rendered nothing while it kicked off the heavy
  `CollectInspectSnapshot` round-trip, so the panel looked frozen.
  Now: initial state is `loading` with an animated shimmer skeleton
  that paints synchronously on first commit, the snapshot collection
  is deferred via `requestIdleCallback`, and a module-scoped cache
  keeps the last snapshot so re-opening the tab is instant. A small
  ↻ button in the Inspect header forces a re-collect.
- **Sign in / Share Links no longer detour through Settings (B3).** Both
  the onboarding "Sign in" button and the signed-out Share Links
  button used to open the Settings popover. They now trigger the WP
  sign-in tab directly via `MK.OpenLoginPopup` (the same flow already
  used inside Settings), surface a "WP login tab opened" hint in the
  status region, and auto-dismiss the onboarding banner on success.
- No new permissions, no REST changes, no schema changes — pure
  extension UI fixes. WP plugin v2.5.4 is unchanged. Zips + sha256
  refreshed.

## [WP 2.5.4 / Extension 2.5.7] — 2026-05-14
## [Extension 2.5.8] — 2026-05-14

### Added — Smart Share preview thumbnails (Option E)

- Recent Shares rows in the Settings popover now render a 36×36
  preview thumbnail on the left, sourced from the share session's
  signed `urls.image` asset (lazy-loaded, no-referrer, graceful
  hide on 404). Sessions without an image fall back to a neutral
  monogram tile showing the first letter of the export `kind`.
- Pure CSS additions (`.lpe-share-thumb` /
  `.lpe-share-thumb-empty`) — no new REST routes, no schema
  changes, no extra network calls beyond the asset already linked
  from the row.
- 181/181 extension tests still green.
- Bumped extension to `2.5.8`; repackaged
  `public/inspect-page.zip`.


### Added — i18n pass (D3)

- WP plugin now loads translations from `wp-plugin/inspect-page/languages/`
  via `load_plugin_textdomain( 'inspect-page', … )` on `plugins_loaded`.
- Generated `languages/inspect-page.pot` (145 unique msgids extracted
  from every `__()` / `esc_html__()` / `esc_attr__()` call site,
  including the new D1 "Download CSV" button + Recent visitors drawer
  headers and the D2 "Email digest" panel cadence labels).
- Extension: locate-color toast strings (`No matches`, `N matches for #abc`,
  error fallback) moved out of the React component and into
  `extension-src/shared/copy.ts` (`inspectColorLocateNone`,
  `inspectColorLocateCount`, `inspectColorLocateCountPlural`,
  `inspectColorLocateError`) so the panel renders them via
  `format(COPY.…, { n, value })` like every other label. 181/181
  extension tests still green.
- Bumped extension to `2.5.7` and WP plugin to `2.5.4`; repackaged
  `public/inspect-page.zip` + `public/inspect-page-wp.zip` (+ sha256s).

## [WP 2.5.3] — 2026-05-14

### Added — Weekly digest tuning (D2)

- Per-user cadence: new `inspect_page_digest_cadence` user meta with
  values `weekly` (default) and `daily` (Pro only — server-side
  enforced in `InspectPage_Digest::set_cadence()`).
- Cron split: existing weekly `inspect_page_weekly_digest` now skips
  users on `daily`; new `inspect_page_daily_digest` (registered in
  the activator with WP's `daily` interval) emails only Pro users on
  the daily cadence using a 1-day window.
- Open-rate pixel: digest emails are now multipart/alternative; the
  HTML part embeds a 1×1 transparent PNG served by REST
  `GET /inspect-page/v1/digest/open/{token}.png`. Each open updates
  `inspect_page_digest_last_open` + `_open_count` + a rolling 30-day
  `_open_log` JSON list.
- Admin Tools → Sessions screen gains an **Email digest** panel:
  cadence dropdown + opt-out checkbox + table showing last cron run,
  last open, and opens in the last 7 days
  (`InspectPage_Digest::opens_last_7d`).
- 4 new unit tests in `tests/test-digest.php` cover cadence routing,
  daily cron Pro-only filter, default cadence, and
  `opens_last_7d` window math. All Digest + Stats tests pass.
- Bumped WP plugin to `2.5.3`; repackaged `public/inspect-page-wp.zip`.

## [WP 2.5.2] — 2026-05-14

### Added — CSV export of share-link visitor events (Pro)

- New REST route `GET /inspect-page/v1/sessions/{id}/events.csv`
  (cookie + `X-WP-Nonce`). Streams up to 200 most-recent anonymized
  events for a single session as a CSV with columns
  `created_at_utc, kind, ip_hash, ua_hash`.
- Pro-gated: returns `402 E_PRO_REQUIRED` when the owner is on Free
  or has not opted into the visitor log; `403 E_SHARE_FORBIDDEN`
  when the requester is not the owner; `404 E_SHARE_NOT_FOUND`
  for unknown ids.
- "Recent visitors" drawer in the WP plugin Privacy section now
  shows a per-session "Download CSV" button next to the first row
  for each session.
- New `InspectPage_Stats::events_for_session()` + 5 unit tests
  (`tests/test-stats.php`) covering 404/403/402/Pro-no-opt-in/
  Pro+opt-in success paths.
- Bumped WP plugin to `2.5.2`; repackaged `public/inspect-page-wp.zip`.

## [WP 2.5.1 / Extension 2.5.5] — 2026-05-14

## [Extension 2.5.6] — 2026-05-14

### Fixed — Locate color button (Phase A8b)

- The crosshair (`⌖`) button next to each color in the Inspector
  Colors panel was a documented stub — clicking it did nothing. It
  now scans the active tab's live DOM via a new `LocateColor`
  message, scrolls the first match into view, and flashes a pulsing
  ring around every element whose computed `background`, `color`,
  border, outline, `fill`, or `stroke` equals the target hex.
- Toast feedback below the colors list reports `N matches for #abc`
  (or `No matches`) and auto-clears after 2 s.
- New module `extension-src/inspect/locateColor.ts` (`findColorMatches`
  + `flashElements` + `locateColor`) — pure scan capped at 8000
  elements; injected `<style>` tag drives a 1.5 s
  `lpe-locate-pulse` keyframe.
- Background route forwards to active tab via `chrome.tabs.query`
  fallback so it works from popup and floating panel.
- Tests: `inspect/__tests__/locateColor.test.ts` (6 cases) → 181/181
  extension green.
- Repackaged `public/inspect-page.zip` at extension `2.5.6`.


### Added — Share-link analytics (Option A)

- **Aggregate counters**: every Smart Share asset fetch increments a
  per-session `views` counter and a `views_per_file` JSON map (`html`,
  `css`, `js`, `image`) plus `last_viewed_at`. Cron + REST writes are
  guarded by a small `Stats` class so failures never break the asset
  response.
- **REST**: `list_sessions` now returns `views`, `views_per_file`, and
  `last_viewed_at` (ISO UTC). New `GET /sessions/{id}/stats` returns
  the same payload for a single session, with full error mapping
  (`E_SHARE_AUTH`, `E_SHARE_NOT_FOUND`, `E_SHARE_NETWORK`,
  `E_SHARE_BAD_INPUT`).
- **Recent Shares badge**: each row in the Settings popover now shows a
  `👁 N` pill that expands into a per-file breakdown
  (`html N · css N · js N · image N`) plus the last-viewed timestamp.
  The list auto-refreshes on `window.focus`.
- **Opt-in event log (Pro only)**: when an admin enables the
  "Recent visitors" privacy toggle, Pro accounts record up to 30 days
  of `pp_share_events` rows (hashed IP, hashed UA, file kind, ts).
  Admin → Inspect Page → Sessions exposes a "Recent visitors" drawer
  with anonymised counts. Free plans never write events. Hashing uses
  `inspect_page_url_secret` so raw IPs/UAs are never stored.
- **Tests**: 175/175 extension vitest cases green; new WP unit tests
  cover the stats counters, events table, and privacy toggle.
- **Repackaged**: `public/inspect-page.zip` and
  `public/inspect-page-wp.zip` (sha256s in
  `*.zip.sha256`).

## [Extension 2.5.4] — 2026-05-14

### Added — In-extension billing UI (Option C)

- **Enriched `/billing/status`**: the WP plugin now returns `plan`
  (`pro` / `free`), `lifetime_used`, `free_limit`, and `remaining` so
  the extension can render plan + quota state without a second
  roundtrip.
- **`getBillingStatus()` client wrapper**: typed cookie + `X-WP-Nonce`
  GET in `extension-src/share/getBillingStatus.ts` with full error
  mapping (`E_SHARE_AUTH` / `E_SHARE_NETWORK`) and 5 vitest cases.
- **Pricing card / active-license panel**: a new `BillingPanel` block
  in the Settings popover shows a plan badge (Pro / Free), a masked
  subscription id (`sub_1A2B…7Z9X`) on Pro, and the `$5/month —
  unlimited Smart Shares` tagline on Free. Refreshes on focus and on
  the new `inspect-page:billing-changed` event.
- **Post-checkout poll**: `pollBillingUntilPro()` polls
  `/billing/status` every 3 s (5-min timeout) after Upgrade is
  clicked from either the Settings popover or the inline
  `E_SHARE_QUOTA_FREE` error CTA. On flip to Pro it dispatches
  `inspect-page:billing-changed`, which both `BillingPanel` and the
  Smart Share quota refresher listen to — the UI updates without a
  manual sign-out + sign-in cycle. 3 vitest cases cover success,
  timeout, and cancel.
- **Tests**: 166/166 extension tests green (was 158).
- **Repackaged**: `public/inspect-page.zip` (186K, sha
  `ab7cd1…68acfb`) at extension version `2.5.4`.

## [Extension 2.5.3] — 2026-05-14

### Changed — Panel UI overhaul

- **First view simplified**: opening the popup or floating panel now
  shows just the three tabs (Export / Pick / Inspect) and the active
  tab's primary CTA. The always-on Idle status, the inline Settings
  disclosure, and the standalone Smart Share section are gone.
- **Settings popover**: the `≡` icon left of "Inspect Page" is now a
  real button. It toggles a settings popover anchored under the header
  containing Settings + Smart Share account. Esc closes and returns
  focus to the button.
- **Share Links is per-tab**: a secondary **Share Links** button now
  appears below the primary CTA in the Export and Pick tabs (not in
  Inspect). Signed-out → opens the settings popover. Signed-in but no
  artifacts yet → disabled with "Run export first". Signed-in with
  artifacts → triggers the share session and opens the existing share
  dialog.
- **Header buttons fixed**: minimize now leaves a small restore pill
  bottom-right of the page; pop-out migrates to a detached window and
  tears down the in-page panel; close fully unmounts.
- **Palette refresh** (CSS Peeper-grade): layered dark surfaces
  (`#0E1116` / `#151A22` / `#1C232E`), hairline borders (`#262E3B`),
  text hierarchy (`#E6EAF2 / #9AA4B2 / #5E6878`), accent shifted to
  `#3B82F6 → #2563EB` hover. Buttons get 10px radius, soft inner
  highlight and 150ms transitions; active tab gets a 2px accent
  underline with subtle glow. Light theme gets a parallel pass.

### Internal

- 88/88 extension tests still pass.
- Repackaged `public/inspect-page.zip` (186K).

## [Extension 2.5.1] — 2026-05-14

### Added — Picker chip in-page action icons

- The `W × H` size badge is now part of a clickable chip group with
  three icon buttons rendered directly on the page while the picker is
  active: **✓ Select element**, **⧉ Copy selector**, **✕ Cancel
  picker**. Right-click and Enter still work as redundant Select
  shortcuts.
- Hovering the chip suppresses overlay re-targeting so the highlighted
  element stays stable while you aim for an action button. Chip flips
  above the element near the viewport bottom edge.
- Copy flashes a "Copied" tag inside the chip and emits a
  `LogCategory.Picker` info log with the copied selector.
- Bumped extension manifest + package to 2.5.1.

### Fixed — Inspector action buttons styling

- Removed a duplicate `.lpe-link` rule in `panel/styles.css` (lines
  701–704) that was clobbering the Inspector's Copy / Anchor / Show
  Code buttons with underlined-link styling.
- Wrapped those three buttons in a new `.lpe-inspector-actions`
  toolbar (horizontal flex, top border, themed bordered buttons) so
  they no longer stack as a stray vertical column under the styles
  table.

## [Extension 2.5.0] — 2026-05-14

### Added — Pick Element rich inspector (v2.5)

- **Picker overlay**: dashed orange margin / dashed green padding rulers
  with per-side px badges, plus a `W × H` size chip and a richer info
  tip (tag, id, classes, role) — modeled after the Argument-style
  inspector requested by the user.
- **Element snapshot collector** (`collectElementSnapshot`): identity,
  full box-model, text properties, selection foreground/background +
  WCAG contrast verdict, matched CSS split by `:base/:hover/:focus/
  :active/:disabled`, and a grouped computed-style diff (Layout,
  Typography, Background, Border, Effects, Other).
- **Element Inspector panel**: identity row, "Context menu while
  hovering" lock toggle, box-model diagram, text properties (font
  family / size / line-height / weight / letter-spacing / color with
  swatch + copy), and a Selection-colors block with foreground/
  background swatches, `Aa` preview, contrast ratio, Excellent / Good
  / Poor / Fail verdict pill, and AA / AAA pass-fail tags that respect
  the WCAG large-text rule.
- **Code drawer**: tabbed view of matched CSS by pseudo-state and
  computed-style overrides by group, each with a one-click copy.
- **Export modes docked under the inspector**: MD single, MD + files,
  ZIP + prompt, and Smart Share — same four modes as Export Page so
  Pick Element produces identical AI-ready bundles.

## [Extension 2.3.0] — 2026-05-13

### Added — Stripe billing (in-extension)

- Settings → Smart Share now offers **Upgrade to Pro** for free users at
  quota and **Manage subscription** for Pro users. Both call the WP
  plugin REST endpoints (`/billing/checkout`, `/billing/portal`) over
  cookie + `X-WP-Nonce` and open Stripe-hosted pages in a new tab.
  Falls back to the static pricing URL when billing is not configured.
- Inline **Upgrade to Pro** CTA inside the Smart Share error row when
  `E_SHARE_QUOTA_FREE` fires, so users can upgrade without hunting in
  Settings.
- Free quota progress bar (blue → amber at 1 left → red at exhausted)
  with proper `role="progressbar"` ARIA.
- Quota auto-refresh on window focus / tab visibility — license
  flips from Stripe Checkout / Customer Portal are reflected without a
  manual sign-out cycle.
- New WP shortcode `[inspect_page_pricing]` renders a Free vs Pro
  comparison + one-click Stripe Checkout (or Customer Portal for Pro
  users) directly on the marketing site.

### Deferred to v2.4

- Picker-chip action icon — there is no on-page picker chip UI today,
  so the "action icon" UX call from the original spec is parked until a
  picker overlay actually ships. Will revisit alongside the picker
  overlay redesign.

### Added — Inspect Mode (A1–A14)

- New third panel tab **Inspect** alongside Export and Pick. CSS-Peeper-
  class read-only inspector — works on any page, no sign-in required.
- **Overview** card: viewport thumbnail + page title + URL + Open docs.
- **Typography**: Headings + Body cards (family · generic chip ·
  weights · text-style count) + "Show all" modal.
- **Colors**: dedup'd Palette tab + Categories tab (background / text /
  border / fill / stroke / gradient / shadow / other) with per-row
  Locate + Copy.
- **Color Detail drawer**: hex / rgb / hsl / alpha + per-format copy.
- **Contrast Scanner**: pass/fail summary + Failing/Passing tabs +
  per-pair AA/AAA grid.
- **CSS Information**: rule count, inlined CSS bytes, external sheet
  count, &lt;style&gt; tag count, unreachable-sheet warning.
- **Element Inspector**: largest-element list, expandable computed
  styles, Set-as-anchor + distance panel, Copy selector.
- **Show Code drawer**: synthesized HTML/CSS for a sample with Copy.
- **Export report ▾** menu: JSON / Markdown / Colors CSV / Fonts CSV
  with stable serializers (`extension-src/inspect/exportSnapshot.ts`).
- **Floating panel**: SE-corner resize handle (clamped 320×240 –
  720×900), detached pop-out window via `chrome.windows.create`.
- **Theme toggle**: ☾ / ☀ in header; full dark-theme variants for every
  status / button / input / pill so contrast stays ≥4.5:1 in both modes.
- Footer: "Inspect Page v2.3.0".
- 74 unit tests (snapshot, contrast math, color math, distance,
  synthesizeCode, exportSnapshot, rankSamples) — all green.

## [WP plugin 2.2.1] — 2026-05-12
## [WP plugin 2.3.0] — 2026-05-13

## [WP plugin 2.5.0] — 2026-05-14

### Added — Weekly digest of expired Smart Share sessions

- New `InspectPage_Digest` class. WP-Cron event
  `inspect_page_weekly_digest` (registered with a `weekly` interval) runs
  once a week, finds every WP user who had ≥1 Smart Share session expire
  in the last 7 days, and emails them a per-user summary listing source
  URL + expiry timestamp for each session (capped at 50 rows with an
  "…and N more" overflow line).
- Footer adapts to license: Pro users see "Smart Share is unlimited.
  Manage subscription" with the account URL; Free users see
  "X of Y free Smart Share links used. Upgrade to Pro" with the pricing
  URL.
- One-click unsubscribe via per-user 32-char token in `inspect_page_digest_token`
  user meta. Token-based (not nonce) so the link survives email-client
  redirection and works without an active WP login. Hits
  `?inspect_page_digest_unsubscribe=<token>` on any front-end page;
  handler flips `inspect_page_digest_optout` and shows a confirmation.
- Activator now schedules the weekly cron with a 1-day initial offset so
  freshly-installed sites don't email immediately.
- 21 new PHPUnit-style assertions in `tests/test-digest.php` covering
  per-user grouping, opt-out skip, Pro vs Free footer, token round-trip,
  empty-result no-op, and `last_run` option update.
- Plugin version bumped to **2.5.0** (`inspect-page.php` header +
  `INSPECT_PAGE_VERSION` constant).

### Added — Lifetime free-share quota + license gate

- New `InspectPage_License` helper: every Smart Share upload now passes
  through `can_share($user_id)`. Free users get a **lifetime quota of
  5** Smart Share sessions (option `inspect_page_free_lifetime_limit`,
  default 5). When the limit is hit the REST `POST /sessions` returns
  `402 E_SHARE_QUOTA_FREE` instead of the asset bundle.
- License flag stored as user meta `inspect_page_license` (`active` =
  unlimited). Until billing is wired (planned), site admins grant the
  license manually via Users → Edit user → custom meta. Stripe / Paddle
  hookup will land in a follow-up release.
- `GET /auth-status` quota payload extended with `lifetime_used`,
  `free_limit`, `has_license`.
- Extension: Settings → Smart Share now shows
  **"Free shares used: X / 5"** (or **"Pro plan — unlimited shares"**
  when licensed). On `402` Smart Share fails fast with a friendly
  "Upgrade to Pro — coming soon" message.
- Plugin version bumped to `2.3.0`; `inspect-page-wp.zip` repackaged.

### Changed

- **Plugin row "Visit plugin site"** now opens the in-WP Inspect Page
  dashboard (`admin.php?page=inspect-page`) instead of an external URL.
- **Inspect Page dashboard rebuilt**: shows the signed-in WP user, extension
  pairing instructions, REST + permalinks health checks, live quota
  counters (active sessions vs limit, uploads in the last hour vs
  limit), and the user's 10 most recent share sessions with links to
  all 4 public URLs.
- **Tools → Inspect Page Sessions**: added a `js` column, a 24h expiry
  countdown next to `expires_at`, and a friendly empty state.
- Plugin version bumped to `2.2.1`; `inspect-page-wp.zip` repackaged.

## [2.2.0] — 2026-05-12

### Changed — Smart Share v2.2 (no more pairing tokens)

- **Auth replaced**: Inspect Page pairing tokens (`PPT1.…`) are gone. The
  WordPress plugin now authenticates the extension via the standard
  WordPress login cookie + `X-WP-Nonce`. Users sign in by clicking
  **Sign in** in the extension's `Settings → Smart Share (WordPress)`
  panel, which opens a hidden `inspect-page-bridge` admin page that forwards
  the `wp_rest` nonce to the extension via `postMessage`.
- **Four files, four URLs**: Smart Share now uploads HTML / CSS / **JS**
  / screenshot and serves them at `/share/{id}/index.html`,
  `/style.css`, `/script.js`, `/preview.png`. The AI instruction block
  references all four.
- **Quotas per WP user** (not per token): 30 active sessions, 60
  uploads/hour. New table `pp_rate_events` is pruned hourly.
- **New share dialog** in the extension lists the four URLs with copy
  buttons, a live 24-hour countdown, "Copy AI prompt + 4 URLs", and an
  inline **Revoke now** button (calls `DELETE /sessions/{id}`).
- **Removed**: `class-pairing.php`, `pairingToken` / `tokenId` /
  `pairedAtIso` extension settings, the pairing token UI in
  `Tools → Inspect Page`, and the `DELETE /pairing/self` REST route.
- **WP plugin version bumped** to 2.2.0; landing copy and Privacy page
  updated for cookie-based Smart Share; `inspect-page-wp.zip` repackaged.

## [2.0.0] — 2026-05-10

### Added — v2 Inspect Page backend (`spec/21-app/`)

- **WordPress companion plugin** (`wp-plugin/inspect-page/`, distributed as
  `public/inspect-page-wp.zip`). Registers REST namespace `inspect-page/v1` with
  routes `POST /sessions`, `GET /sessions`, `DELETE /sessions/{id}`,
  `GET /share/{id}/{html|css|image}`, and `DELETE /pairing/self`. Stores
  uploads under `wp-content/uploads/inspect-page/{user_id}/{session_id}/` and
  records sessions + assets in `wp_pp_share_sessions` /
  `wp_pp_share_assets` with normalized enum tables (kinds, statuses,
  asset types).
- **Inspect Page pairing tokens** (`PPT1.<base64url(payload)>.<base64url(hmac)>`).
  Admin mints a token in **Tools → Inspect Page**; the payload encodes
  `{ v:1, site, tid, uid }` so the extension never asks the user to
  type a site URL or password. Server signs with
  `inspect_page_signing_key` (auto-generated on activation) and verifies on
  every Bearer-authenticated request. Tokens are tracked in
  `wp_pp_pairing_tokens` and revocable from wp-admin or via
  `DELETE /pairing/self`.
- **Per-token quota** of 30 active sessions
  (`inspect_page_max_active_per_token`). Excess uploads return HTTP 429 →
  `E_SHARE_QUOTA`; the extension surfaces a "Revoke old links" hint.
- **24h share-link TTL** (`INSPECT_PAGE_SHARE_TTL`). Expired or revoked
  sessions return 404 `E_SHARE_EXPIRED` and their files are pruned.
- **Four export modes** (`spec/21-app/24-export-modes.md`): MD single
  (base64 inline), MD + files (zip), ZIP (with `prompt.md`), and Share
  Links (3 WP URLs + AI instruction block). Both Full Page and Element
  flows expose all four.
- **Extension Settings — Share Links section**: paste a `PPT1.…` token
  to pair; site URL is decoded automatically. "Unpair" now performs a
  best-effort `DELETE /pairing/self` so the server-side token is revoked
  in the same click.

### Changed

- Auth model migrated **from WordPress Application Passwords to Inspect Page
  pairing tokens**. The `siteUrl` / `username` / `appPassword` fields in
  `ShareSettings` are gone; the new shape is
  `{ pairingToken, siteUrl, tokenId, pairedAtIso }`.
- Landing-page WP install instructions rewritten to match the new flow.
- Spec docs `25-share-links.md`, `26-implementation-order-v2.md`,
  `09-error-handling.md`, and `11-acceptance-criteria.md` updated for
  pairing-token auth, quota error, and unpair flow.

### Security

- HMAC-SHA256 signature is verified for every Bearer request; tampered
  tokens are rejected with 401 `E_SHARE_AUTH` (covered by smoke test
  `extension-src/share/__tests__/smokeE2E.test.ts`).
- Capability check `upload_files` enforced on all write routes.
- Asset reads emit `X-Content-Type-Options: nosniff` and
  `Content-Disposition: inline`.

### Tests

- `parsePairingToken` (10 cases): happy path, malformed prefix,
  segmenting, b64url errors, version mismatch, missing/typed fields.
- `createShareSession` (8 cases): unpaired guard, multipart payload,
  jpg/png suffix, network error, 401, 429, 5xx, 4xx.
- `smokeE2E` (2 cases): full mint → pair → 30 uploads → 31st quota → unpair → 401
  flow, plus tampered-signature rejection (in-memory WP REST mirror with
  real HMAC verification).

## [1.1.0] — 2026-05-06

### Added — v2 fidelity pass (`spec/19-edge-cases.md`)

- **Open shadow DOM walker** — full-page and element exports now recurse
  into every `Element.shadowRoot` whose mode is `"open"` and inline its
  children as a [Declarative Shadow DOM](https://developer.chrome.com/articles/declarative-shadow-dom/)
  `<template shadowrootmode="open">` block. Web-component-driven sites
  (Lit, FAST, Spectrum, Ionic, YouTube player chrome, GitHub
  primer-elements, …) now round-trip with their visible markup intact.
  Closed shadow roots are deliberately *not* expanded — the platform's
  privacy boundary is preserved.
- **Constructed stylesheets capture** — `adoptedStyleSheets` attached to
  any open shadow root or to `document` are serialized via `cssRules`
  and inlined as `<style data-adopted-stylesheet="true">` tags so that
  CSS authored via `new CSSStyleSheet()` (the Lit/FAST default) survives
  the export.
- **Font binary bundling** — every `@font-face { … src: url(…) … }`
  reference in the collected CSS is fetched (`credentials: "omit"`),
  base64-encoded, and rewritten to a `data:` URI. Per-font cap defaults
  to 1 MiB; total budget defaults to 5 MiB; identical URLs are
  deduplicated. Exports now render with original typography fully
  offline.
- **Cross-origin iframe traversal** — same-origin `<iframe>`s have their
  `contentDocument` recursively serialized (HTML + CSS + adopted sheets +
  font bundling) and inlined as `srcdoc="…"` plus a
  `data-inspect-page-srcdoc="true"` marker. Cross-origin frames are left
  with their original `src` and tagged
  `data-inspect-page-cross-origin="true"` so consumers can see what was
  unreachable. Recursion depth is capped at 3.
- **Export metadata expansion** — `ExportMeta.counts` now reports
  `fontsInlined`, `fontsBytesInlined`, `fontsFailed`, `iframesTotal`,
  `iframesSameOrigin`, `iframesCrossOrigin`, and `iframesFailed`.
- **In-panel telemetry surface** — successful Full Page exports now
  render a "Captured in this export" block in the floating panel,
  showing shadow roots expanded, fonts inlined (with compact byte
  size), same/cross-origin iframes, stylesheets, and capture frames.
  Zero-valued counters are omitted so minimal pages produce a minimal
  block. Adds `shadowRootsExpanded` to `ExportMeta.counts`.
- **Element-export telemetry parity** — successful element exports now
  surface the same "Captured in this export" block via a `Success`
  `StatusUpdate` broadcast carrying telemetry (the element flow has no
  top-level response). Reports `outerHTML` bytes, matched-CSS rule
  count, computed-style diff entry count, and combined context +
  isolated screenshot bytes. When the offscreen isolated render fails,
  the row reads `X KB + isolated skipped`. Adds optional
  `elementOuterHtmlBytes`, `elementMatchedRules`,
  `elementComputedDiffEntries`, `elementContextPngBytes`,
  `elementIsolatedPngBytes`, `elementIsolatedSkipped` to
  `ExportMeta.counts`, and an optional `telemetry` field to
  `StatusUpdatePayload`.

### Added — Tooling

- **CI** — `.github/workflows/extension-ci.yml` runs lint, tests, build,
  and packaging on every push / PR touching `extension*/`. Enforces the
  1.5 MiB package budget (AC-BD-2) and uploads the resulting zip +
  checksum as a 30-day artifact.
- **Chrome Web Store assets** — `store-assets/` now contains the listing
  copy (`LISTING.md`), 5 × 1280×800 screenshots, a 440×280 small promo
  tile, and a 1400×560 marquee tile, all sized to spec.
- **QA checklist (v1.1)** — `docs/QA-CHECKLIST.md` gains §7 (T19–T22)
  covering the four v2 features, the full-page panel telemetry, and the
  element-export telemetry parity, with 27 new acceptance items
  (AC-FD-1 … AC-FD-27) and a printable PDF mirror at
  `/mnt/documents/inspect-page-qa-checklist.pdf`.

### Changed

- `collectHtml` no longer mutates a cloned `<html>` to inject `<base>`
  and `<meta charset>`; it patches the serialized string in place.
- `extension/vitest.config.ts` adds `environmentMatchGlobs` so DOM-touching
  tests under `capture/**` and `element/**` run in `happy-dom`, while
  pure-logic tests stay in the faster `node` env. `server.fs.allow` is
  widened to permit reading test files from `../extension-src`.

### Fixed

- Lint script now scopes to `../extension-src` and exits 0 on a clean tree
  (was previously walking unrelated build output).
- Toolbar/store icons regenerated at exact 16/48/128/440/1400 sizes with
  consistent rounded-rectangle geometry.

### Test coverage

- 70/70 tests passing (29 → 70). New suites:
  `extension-src/capture/__tests__/shadow.test.ts` (12),
  `extension-src/capture/__tests__/inlineFonts.test.ts` (9),
  `extension-src/capture/__tests__/inlineIframes.test.ts` (6),
  `extension-src/panel/__tests__/telemetry.test.ts` (11),
  `extension-src/element/__tests__/elementTelemetry.test.ts` (3).

### Package

- `public/inspect-page.zip`: 171 KB (well under the 1.5 MiB AC-BD-2 budget).
- `public/inspect-page.zip.sha256`: refreshed.

## [1.0.0] — 2026-05-06

Initial release. Full-Page and Element export modes, floating panel,
keyboard shortcuts (`Alt+Shift+E` / `P`), settings persistence,
sticky-header handling, password-field redaction, and a 29-test unit
suite. See `spec/21-app/` for the implementation specification.