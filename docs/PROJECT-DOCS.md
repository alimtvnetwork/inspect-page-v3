# Inspect Page — Consolidated Project Docs

> Single source of truth for the Inspect Page Chrome extension + WordPress plugin.
> This file consolidates and replaces every prior file under `docs/`. Older release-notes,
> acceptance-criteria, pen-test, phase-plan, and runbook files have been intentionally
> deleted to remove ambiguity — do not recreate per-version files in `docs/` going forward.
> Append new releases as a new section at the top of "Release History" instead.

---

## 1. Product snapshot

- **Name:** Inspect Page (two words, capital I + P).
- **Shipped:** Extension `v2.7.6` + WordPress plugin `v2.6.0`.
- **Stack:** MV3 Chrome extension (TypeScript) + WordPress plugin (PHP).
- **Backend decision:** WordPress plugin (locked). Auth = WP login cookie + `X-WP-Nonce`.
- **Brand-name rule:** never use "PagePort", "LLM Export", "LLM Page Export", or
  `llm-export` anywhere — UI, code, comments, file names, zips, docs.
- **Zips:** `inspect-page.zip` / `inspect-page-wp.zip`.
- **REST namespace:** `inspect-page/v1`. **Plugin folder:** `wp-plugin/inspect-page/`.
- **Constants:** `INSPECT_PAGE_WP_SITE_URL`, meta key `inspect_page_license`,
  storage key `inspect-page`, log prefix `[inspect-page]`.

---

## 2. Current capabilities (v2.7.6 baseline)

### Export modes
1. **MD single** — base64-embedded Markdown.
2. **MD + files** — zip with separate assets.
3. **ZIP** — `prompt.md` + assets.
4. **Smart Share** — uploads to WP, returns 4 share URLs + AI instruction block.

### Color Tokens v2 (v2.7.5)
- Every detected color → `--ip-color-N` token with tint(+12% L)/base/shade(-12% L) variants.
- Exports gain `## Color tokens`, `## Variants`, `## Selector map` Markdown blocks.
- `tokens.css` + `selectors.css` files in MD+files and ZIP.
- Same CSS baked into Smart Share via `withAddonsBakedIn` (`panel/ExportModes.tsx`).
- **Inspect → Colors → Tokens** sub-tab: rename tokens + attach per-selector custom CSS,
  persisted in `chrome.storage.local` under `inspect-page:color-tokens:<fnv32>`.
- Modules: `inspect/colorVariants.ts`, `inspect/colorSelectorIndex.ts`,
  `inspect/colorTokenStorage.ts`, `inspect/colorTokensExport.ts`,
  `panel/inspect/InspectColorTokens.tsx`, `panel/inspect/snapshotCache.ts`.

### Multi-element picker (v2.7.2)
- Up to 11 elements; toggle-click adds/removes; Shift+Click also adds; Esc cancels.
- Sticky `[ Done (N) ] [ Cancel ] N/11` bar; green outline + numbered badges.
- Combined MD/ZIP/Smart Share emits one section per element with
  `<!-- Element N — selector -->` / `/* Element N — selector */` blocks plus a
  `## Source — Element N` block (URL, Captured ISO, Selector path, Title, Viewport @ DPR).
- Builder: `buildCombinedElementArtifacts` in `extension-src/panel/ExportPanel.tsx`.

### Full-page export hardening
- v2.7.4 — packaged MV3 offscreen capture files (`offscreen.html` + `offscreen.js`);
  packaging now fails fast if `offscreen.html` is missing.
- v2.7.3 — all host gatekeeping deleted from `background.ts`. Active tab is always
  the target. Only Chrome-forbidden URLs (chrome://, chrome-extension://, edge://,
  about:, view-source:, file://, Web Store) error out, naturally via
  `ensureContentScript`. **Do not re-add host allow/blocklists.**

### Team Workspaces (v2.7.0)
- Tables: `wp_pp_workspaces`, `wp_pp_workspace_members`, `wp_pp_workspace_invites`.
- Roles: owner / admin / member. Activation backfills every WP user into a solo
  workspace and copies legacy `inspect_page_license=active` → `workspaces.license_status`.
- REST: `/workspaces*` + `/workspaces/accept` + admin-only invite CRUD + transfer-owner.
- Invites: 64-hex tokens, 7-day TTL, single-use, `wp_mail()`'d with hidden
  `inspect-page-accept` admin landing page.
- Billing port: `/billing/checkout` & `/billing/portal` accept `workspace_id`
  (default = primary, owner/admin gated); attach `metadata[workspace_id]`;
  prefer workspace's `stripe_customer_id`. Webhook flips
  `workspaces.license_status` to active/past_due/canceled and keeps legacy
  user-meta in parallel for back-compat. `/billing/status?workspace_id=N` returns a
  `workspace` block alongside legacy fields.
- Extension: `getBillingStatus`/`startBillingCheckout`/`startBillingPortal` accept
  optional `workspaceId`; `listWorkspaces()` with graceful 404 fallback.
- Admin page: Tools → **Inspect Page Workspaces** (switcher, create, members, invites).
- Popup: `WorkspacePicker` modal (`panel/WorkspacePicker.tsx`) — chip → dialog with
  role + license badges + "Manage in WordPress" deep-link.

### Billing
- Stripe Checkout + Customer Portal via REST `/billing/checkout|portal|webhook|status`,
  signature-verified.
- `/billing/status` enriched with Stripe `prices.retrieve` (12h transient cache,
  plugin v2.5.5+); extension renders dynamic "$X / interval" tagline via
  `formatBillingPriceTagline`.

### Quotas
- Per-WP-user: 30 active sessions, 60 uploads/hour, lifetime free quota **5**.
- Beyond 5 → `402 E_SHARE_QUOTA_FREE` unless `inspect_page_license = active`.

### Theme (LOCKED — dark-mint, user-approved)
- bg `#0B0F0E`, fg `#F5FFFA`, surface `#111715`, accent `#2DD4A8` → glow `#73FFB8`.
- Primary gradient `linear-gradient(135deg,#2DD4A8,#73FFB8)`.
- Popup AND floating panel both use this. Do not repaint without explicit request.

### Geometry guards (v2.7.0+)
- Floating panel visual size locked to 412×820 on every site and Chrome zoom level
  via `chrome.tabs.getZoom` compensation (do **not** use DPR heuristics).
- `.lpe-btn-hero` `max-height: 56px !important; flex: 0 0 auto !important`.
- `.lpe-btn-ico` `width/height: 18px !important` + `max-*: 18px !important`.
- Hero SVG carries intrinsic `width="18" height="18"` attrs as belt-and-suspenders.
- If popup balloons after extension reload → History-revert, do not patch CSS further.

### Test coverage
- 212/212 vitest passing.
- 68/68 PHP assertions passing.

---

## 3. Acceptance criteria — current (v2.7.0 / ext v2.7.26 static walkthrough)

Legend: `[x]` static-pass · `[~]` requires live env · `[ ]` fail.

### AC-BILL — Stripe billing
- [x] **BILL-1** `startBillingCheckout()` → `/billing/checkout` → Stripe Checkout URL.
  Webhook `checkout.session.completed` → `activate()` → `inspect_page_license=active`.
- [~] **BILL-2** Quota-error inline CTA path exists in `ExportPanel.tsx`. Live Stripe needed.
- [x] **BILL-3** `/billing/portal` → customer-portal URL; `customer.subscription.deleted`
  → `deactivate()`. Quota row recomputes on next `/billing/status`.
- [~] **BILL-4** Shortcode `[inspect_page_pricing]` defined; needs live render.
- [~] **BILL-5** Background analytics (`UPGRADE_CLICKED`, `CHECKOUT_OPENED`, etc.)
  defined; needs live SW log inspection.

### AC-ANALYTICS — Share-link analytics
- [x] **A-1** `InspectPage_Stats::record_view()` invoked from `read_asset()`.
- [~] **A-2** Recent-visitors drawer wired in admin Sessions page (Pro-gated). Live UI test.
- [x] **A-3** Visitor inserts gated by `inspect_page_license=active` before writing
  `wp_pp_visitors`. Free users → no rows.

### AC-UI-259 — Popup UX
- [x] **UI-1** Settings overlay covers full popup body; ESC handler; single-chevron
  `<select>` styled via `appearance: none` + custom SVG.
- [x] **UI-2** Inspect tab shimmer skeleton paints synchronously; snapshot cached;
  ↻ calls `collectSnapshot()` fresh.
- [x] **UI-3** Signed-out onboarding `Sign in` + `Share Links` both call
  `openBridgeTab()` directly (no Settings detour).

### AC-WS — Team Workspaces (authoritative)
- **WS-1 Solo backfill** — Every existing WP user has exactly one workspace with role
  `owner`. Legacy `inspect_page_license=active` copied to `license_status`. Idempotent.
- **WS-2 Create + switch** — Owner can create another workspace from WP admin
  (Tools → Inspect Page Workspaces) and from extension WorkspacePicker; new workspace
  defaults role `owner`, `license_status=free`.
- **WS-3 Invite (email + accept)** — Owner/admin invites by email; `wp_mail()` sends
  a 64-hex token link to `/wp-admin/admin.php?page=inspect-page-accept&token=…`;
  signed-in recipient → membership created with invited role; token marked used.
- **WS-4 Invite expiry / replay** — Token > 7 days → `410 Gone`. Already accepted →
  `410 Gone`. Wrong workspace context → `404`.
- **WS-5 Removal revokes access** — Removed user's `/workspaces/{id}/sessions` → `403`;
  `/billing/status?workspace_id=N` no longer includes it.
- **WS-6 License inheritance** — Free member of workspace with `license_status=active`
  gets unlimited Smart Shares against that workspace.
- **WS-7 Owner transfer** — Atomic role swap; single-owner invariant preserved.

All 7 WS ACs need a live WP host (blocked on `INSPECT_PAGE_WP_SITE_URL`).
Drive via `bash scripts/smoke-runbook.sh`.

---

## 4. Launch / live-mode runbook

### Pre-flight (human-only)
1. Pick the production WP site URL. Set `INSPECT_PAGE_WP_SITE_URL` in
   `extension-src/shared/constants.ts` to `https://<your-wp>` (no trailing slash).
2. Set Stripe **live** secret + webhook secret + price ID in WP options.
3. Walk the pen-test checklist (§5).
4. Walk AC-BILL-1..5 + AC-ANALYTICS + AC-UI-259 + AC-WS-1..7 against the live env.
5. Re-shoot Chrome Web Store screenshots (dark-mint popup, NOT white/blue).
6. CWS upload of latest zip (currently v2.7.5).
7. Git tags `ext-v2.7.5` + `wp-v2.6.0`.

### Orchestration
- `scripts/launch-orchestrator.sh` — resumable 11-step launch.
  State in `.lovable/launch-state.json`. Flags: `--status`, `--reset`, `--only`.
- `scripts/verify-prod-build.sh` — pre-launch build sanity.
- `scripts/smoke-runbook.sh` — end-to-end WS-1..7 smoke.
- `scripts/seed-staging.sh` — seed a staging WP for QA.
- `scripts/capture-cws-screenshots.sh` — shoot CWS screenshots.
- `scripts/rollback.sh` — emergency rollback.
- `scripts/post-launch-watch.sh` — 24h monitor (`--once` for single check).

All scripts are idempotent.

### Carry-over (manual, all code + scripts on disk)
- [ ] Prod `INSPECT_PAGE_WP_SITE_URL` (still `""` in `extension-src/shared/constants.ts` — **primary blocker**).
  Provide the origin (e.g. `https://app.inspectpage.com`) and I will set it, rebuild, and repackage.
- [ ] Stripe live keys / price / webhook.
  Provide `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` via the secrets form.
- [ ] CWS screenshots re-shoot (script scaffold ready at `store-assets/screenshots-v2.7.5/`).
- [ ] CWS upload of `public/inspect-page.zip` (v2.7.5).
- [ ] Git tags `ext-v2.7.5` + `wp-v2.6.0` (requires `git tag` push — I cannot run git commands in this sandbox).

---

## 5. Pen-test checklist (v2.7.0)

Auth / RLS:
- WP cookie + `X-WP-Nonce` required on every mutating route.
- Cross-workspace access returns `403 E_SHARE_FORBIDDEN`.

Quotas:
- Lifetime free quota = 5; 6th share → `402 E_SHARE_QUOTA_FREE` unless Pro.
- 60 uploads/hour rate-limit returns `429`.
- 30 active sessions cap enforced on create.

Workspaces:
- Solo backfill idempotent; legacy license carried.
- Invites: 7-day TTL, single-use, workspace-scoped.
- Owner transfer atomic; single-owner invariant.

Stripe:
- `/billing/webhook` signature-verified (raw body, `Stripe-Signature`).
- `metadata[workspace_id]` round-trips through webhook → DB.
- Free → Pro flip surfaces in extension via `pollBillingUntilPro`.

CSP:
- No inline scripts in extension HTML.
- WP shortcode output escaped.
- Share asset reads sanitized; no path traversal via share-id.

---

## 6. Phase 7 plan (DRAFT — awaiting post-launch approval)

**Workspace Analytics & Per-Member Attribution.**

Schema:
- Add `workspace_id` to `wp_pp_sessions`.

REST:
- `/workspaces/{id}/quota` — usage vs cap.
- `/workspaces/{id}/analytics` — per-member breakdown.
- `/workspaces/{id}/analytics.csv` — CSV export.

UI:
- WP admin **Analytics** tab on Tools → Inspect Page Workspaces.

ACs:
- 6 total covering schema migration, RBAC on each route, CSV correctness,
  per-member counts, range filters, empty-state.

---

## 7. Post-launch comms (ready to send for v2.7.x moment)

Assets prepared and on disk:
- CWS "What's new" blurb.
- 3-post Twitter/X thread.
- Customer email for existing Pro users.
- In-app WP admin banner copy.
- `CHANGELOG.md` entry.

Send sequence: CWS blurb → admin banner ships with plugin update →
customer email → Twitter thread → CHANGELOG commit.

---

## 8. QA — visual artifacts

Mandatory after every visual change (slides, PDFs, charts, images, PPTX, DOCX):
1. Convert each page/slide to an image.
2. Inspect every page (not just the first).
3. Check: broken layouts, clipped/overflowing text, missing images/fonts,
   wrong colors, overlapping elements, blank pages, ordering.
4. Re-run the generation script until clean.
5. QA images are temporary — do not ship them to `/mnt/documents/`.
6. After QA, tell the user what was verified or which issues were fixed.

Do **not** use browser tools for artifact QA.

---

## 9. Release history (newest first — append new entries here)

### v2.7.6 — Inspect report download hotfix (current)
Inspect → Export report dropdown items now route through the extension downloads
API with `saveAs: true`, so JSON, Markdown, Colors CSV, and Fonts CSV exports
open Chrome's Save As picker from the floating panel instead of silently failing.

### v2.7.5 — Color Tokens v2
Dark-Calendar token palette, `## Color tokens` + `## Variants` + `## Selector map`
MD blocks, `tokens.css` + `selectors.css` in zips, per-selector custom CSS UI under
**Inspect → Colors → Tokens**. 212/212 vitest.
**Also completed:** CI/CD pipeline (5 validators), `shared/types` split into domain modules,
typed JSON narrowing (`shared/narrow.ts`), kebab-case file rename sweep (83 `.ts` files),
`ExportPanel` decomposition (927 → 968 lines → sub-components). Build + all validators green.

### v2.7.4 — Offscreen packaging hotfix
Packaged required MV3 offscreen capture files; Export Full Page no longer fails at
`phase=captureFullPage` / "Page failed to load". Packaging fails fast if
`offscreen.html` is missing.

### v2.7.3 — Host-gatekeeping rollback
Removed all host allow/blocklists. Active tab is always Export Full Page target.

### v2.7.2 — Multi-element picker
Up to 11 elements; per-element MD/ZIP/Smart Share blocks; `## Source — Element N`.

### v2.7.0 — Team Workspaces
Roles, invites, Stripe-per-workspace billing, workspace picker, admin page.
68/68 PHP assertions.

### v2.6.2 / v2.6.1 — Plugin stabilization
Quota + license-status hardening on the WP side; carries forward into v2.7.x.

### v2.5.7 — Stripe Customer Portal wiring
`/billing/portal` returns hosted portal URL; subscription events round-trip.

### v2.5.1 / v2.5.0 — Stripe Checkout
First end-to-end Pro upgrade path; signature-verified webhook;
`inspect_page_license=active` toggled by `checkout.session.completed`.

### v2.4 (planning)
Multi-element + token export plans; superseded by v2.7.2 + v2.7.5.

### v2.2 — Smart Share GA
WP plugin first ships; cookie + nonce auth bridge; 4-URL share dialog with
24h countdown; quota + uploads-per-hour limits.

---

## 10. GitHub Release template (use for every tag)

```
# Inspect Page vX.Y.Z

### Release Info
| Field | Value |
| --- | --- |
| Extension Version | `vX.Y.Z` |
| WP Plugin Version | `vA.B.C` |
| Branch | `release/vX.Y.Z` |
| Build Date | YYYY-MM-DD HH:MM UTC |
| Channel | Stable |

### What's Changed
- Bullet list of user-visible changes.

### Checksums (SHA256)
- `inspect-page.zip` — <sha256>
- `inspect-page-wp.zip` — <sha256>

### Quick install
- Chrome: load `inspect-page.zip` unpacked.
- WordPress: upload `inspect-page-wp.zip` via Plugins → Add New → Upload.

### Upgrade notes
- Existing Smart Share links keep working.
- WP plugin auto-runs schema upgrade on activation.
- No breaking changes to REST routes.
```

---

*End of consolidated docs. Do not split this file back into per-version notes —
edit in place and append new releases to §9.*

---

## 11. CI/CD pipeline (added 2026-05-21)

Doc-first, AI-portable pipeline modelled on the macro-ahk-v34 reference repo.
Three artifact streams: extension zip, WP plugin zip, marketing site `dist/`.

### Layout
- `pipeline/` — 9 markdown files describing architecture, workflows, scripts,
  build chain, versioning, extending, troubleshooting. **Read this first** to
  reproduce or debug CI.
- `scripts/ci/` — 5 Node validators (brand-name, ext-version-sync,
  wp-version-sync, zip-freshness, axios-pin) + `readme.md`.
- `.github/workflows/` — 6 workflows: `ci.yml`, `release.yml`,
  `release-watcher.yml`, `audit-releases.yml`, `installer-tests.yml`,
  `quality-badges.yml`. Legacy `extension-ci.yml` kept for back-compat.
- `.gitmap/release/` — machine-readable release registry with seed entries
  (`ext-v2.7.5.json`, `wp-v2.6.0.json`, `latest.json`). Auto-refreshed by
  `release-watcher.yml`.
- `security-notes/` — supply-chain pins (`axios-pin.md`, `wp-plugin-pin.md`).

### Release flow
1. Bump `extension-src/manifest.json` (or WP plugin header + `INSPECT_PAGE_VERSION`).
2. Run `bash scripts/release.sh` (extension) or `bash scripts/package-wp.sh` (WP).
3. Run `for s in scripts/ci/check-*.mjs; do node "$s"; done` locally — all must pass.
4. Push tag `ext-vX.Y.Z` or `wp-vX.Y.Z` — `release.yml` builds + publishes.
5. `release-watcher.yml` updates `.gitmap/release/` and commits.
6. Append release note to §9 above.
