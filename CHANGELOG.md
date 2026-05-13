# Changelog

All notable changes to **Inspect Page** are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

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