# Inspect Page Extension v2.6.1

## Fixes
- **Foreign extension overlays no longer pollute Inspect capture.** Added a shared
  injected-overlay detector (`extension-src/inspect/overlayFilter.ts`) that
  identifies third-party extension UI by:
  - custom-element tags (`-` in tag name) injected at `<html>` / `<body>` root,
  - fixed/sticky elements that own a `shadowRoot`,
  - fixed elements pinned at max-tier z-index (≥ 2,147,480,000).
- **Overview thumbnail** (`background.ts → preparePageForInspectThumbnail`)
  hides those overlays before `chrome.tabs.captureVisibleTab` and restores them
  immediately after, so dev widgets like `v2.194.0 [+] [x]` no longer appear.
- **Inspect snapshot collection** (`collectSnapshot.ts`) skips overlay subtrees
  when sampling colors, fonts, typography, and computed styles.
- **Full-page export** (`capture/collectArtifacts.ts`) temporarily detaches
  overlay nodes during HTML/CSS/JS collection inside a try/finally guard, then
  re-inserts them, ensuring exported `index.html` is page-only.

## Tests
- New regression test in `collectSnapshot.test.ts` injects a fake
  `dev-overlay-widget` and asserts it is excluded from snapshot fonts/colors.
- Full suite: **189 / 189 vitest green**.

## Packaging
- `public/inspect-page.zip` + `.sha256` repackaged.
- WP plugin unchanged at v2.5.4.

## Manual launch checklist (still pending)
- Set `INSPECT_PAGE_WP_SITE_URL` in `extension-src/shared/constants.ts` to the
  production WordPress URL.
- Swap Stripe to live keys + price + webhook secret.
- Walk AC-BILL-1…5, AC-ANALYTICS, AC-UI-259.
- Pen-tests.
- Chrome Web Store upload.
- Tag `ext-v2.6.1` and (when shipped) `wp-v2.5.4`.