# Release notes — Inspect Page v2.5.7

_Released 14 May 2026 · Extension `2.5.7` · WP plugin `2.5.4`_

This release closes out the post-launch analytics + i18n pass that
started with WP 2.5.1 (share-link analytics) and lands on a fully
translatable plugin + extension surface. It bundles four shipped
tracks (A8b · D1 · D2 · D3) into a single coordinated drop.

## Highlights

### Locate color button — A8b (Extension 2.5.6)

The crosshair (`⌖`) button next to each color in the Inspector Colors
panel is no longer a stub. Clicking it scans the active tab's live DOM
via a new `LocateColor` message, scrolls the first match into view, and
pulses a 1.5 s ring (`lpe-locate-pulse`) around every element whose
computed `background`, `color`, border, outline, `fill`, or `stroke`
equals the target hex. A toast below the colors list reports
`N matches for #abc` (or `No matches`) and auto-clears after 2 s. Pure
scan capped at 8000 elements; works from popup and floating panel via a
`chrome.tabs.query` fallback. New tests: `inspect/__tests__/locateColor.test.ts`
(6 cases). 181/181 extension green.

### CSV export of visitor events — D1 (WP 2.5.2)

New REST route `GET /inspect-page/v1/sessions/{id}/events.csv` (cookie +
`X-WP-Nonce`) streams up to 200 most-recent anonymized events for a
single session as `created_at_utc, kind, ip_hash, ua_hash`. Pro-gated
(`402 E_PRO_REQUIRED` for Free / no opt-in, `403 E_SHARE_FORBIDDEN`
for non-owners, `404 E_SHARE_NOT_FOUND`). The "Recent visitors" drawer
in the WP plugin Privacy section now shows a per-session "Download CSV"
button. 5 new unit tests in `tests/test-stats.php`.

### Digest cadence + open-rate pixel — D2 (WP 2.5.3)

Per-user `inspect_page_digest_cadence` (`weekly` default; `daily`
Pro-only, server-enforced). Cron split into
`inspect_page_weekly_digest` (skips daily users) and
`inspect_page_daily_digest` (1-day window, Pro daily users only).
Digest emails are now `multipart/alternative`; the HTML part embeds a
1×1 transparent PNG served by `GET /inspect-page/v1/digest/open/{token}.png`,
updating `inspect_page_digest_last_open` + `_open_count` + a rolling
30-day `_open_log`. New **Email digest** panel on Tools → Sessions
shows cadence dropdown, opt-out checkbox, and a stats table (last cron
run, last open, opens in last 7 days). 4 new unit tests.

### Internationalization pass — D3 (WP 2.5.4 / Extension 2.5.7)

- WP plugin loads translations from
  `wp-plugin/inspect-page/languages/` via
  `load_plugin_textdomain( 'inspect-page', … )` on `plugins_loaded`.
- New `languages/inspect-page.pot` with 145 unique msgids extracted
  from every `__()` / `esc_html__()` / `esc_attr__()` / `_x()` /
  `_e()` call site, including the D1 "Download CSV" button, Recent
  visitors drawer headers, and the D2 Email digest cadence labels.
- Extension: locate-color toast strings (`No matches`,
  `N matches for #abc`, error fallback) moved out of
  `panel/inspect/InspectColors.tsx` and into
  `extension-src/shared/copy.ts` as `inspectColorLocateNone`,
  `inspectColorLocateCount`, `inspectColorLocateCountPlural`,
  `inspectColorLocateError`, rendered via `format(COPY.…, { n, value })`
  like every other label.

## Test coverage

- 181/181 extension vitest cases green.
- All Stats + Digest WP unit tests pass (`tests/test-stats.php`,
  `tests/test-digest.php`).

## Full changelog
See [`CHANGELOG.md`](../CHANGELOG.md) entries for WP 2.5.2 / 2.5.3 /
2.5.4 and Extension 2.5.6 / 2.5.7.

## Upgrade notes

- **WP plugin**: drop in `public/inspect-page-wp.zip` (sha256 in
  `inspect-page-wp.zip.sha256`). Activator registers the new
  `inspect_page_daily_digest` cron. No DB schema changes — the new
  user meta keys (`inspect_page_digest_cadence`,
  `inspect_page_digest_last_open`, `_open_count`, `_open_log`) are
  written lazily.
- **Extension**: Web Store users pick up `2.5.7` via the standard
  auto-update channel (no permission changes). For self-hosted
  unpacked installs, drop `chrome://extensions`, remove the previous
  folder, and reload from the new `public/inspect-page.zip` (sha256 in
  `inspect-page.zip.sha256`).
- **Translators**: the new `.pot` lives at
  `wp-plugin/inspect-page/languages/inspect-page.pot`. Drop translated
  `inspect-page-{locale}.mo` files alongside it.
- Existing Smart Share sessions, licenses, and visitor logs are
  unaffected.

## Known follow-ups

- **Phase 6 manual launch** (outside-sandbox): pen-tests, set prod WP
  URL constant, Stripe live keys / price / webhook, walk
  AC-BILL-1…5 plus the new analytics ACs in
  `docs/PHASE-6-LAUNCH-CHECKLIST.md`, Chrome Web Store upload, tag
  `ext-v2.5.7` and WP `v2.5.4`.
- **Option E** (in-sandbox): Smart Share preview thumbnails.
- **Option F** (manual): re-shoot store screenshots for the new
  Settings popover + Recent visitors drawer + Email digest panel.
- **Option B** (large): team workspaces.