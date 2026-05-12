# PagePort — Manual QA Checklist

Use this before every release. Maps 1:1 to the 36 acceptance criteria in
`spec/21-app/11-acceptance-criteria.md`. A release is shippable iff every
box is checked or has a documented waiver.

## 0. Pre-flight (5 min)

- [ ] `cd extension && bun run lint` exits 0 (AC-BD-1)
- [ ] `cd extension && bun run test` reports 95/95 passing (AC-BD-1)
- [ ] `cd extension && bun run build && bun run package` succeeds (AC-BD-2)
- [ ] `public/pageport.zip` ≤ 1.5 MiB and `public/pageport.zip.sha256` exists (AC-BD-2)
- [ ] Unzip the bundle locally; verify the 14 files: `manifest.json`,
      `background.js`, `content.js`, `messaging.js`, `offscreen.{html,js}`,
      `index.css`, `popup/index.{html,js}`, `icons/{16,48,128}.png`
- [ ] `chrome://extensions` → enable Developer mode → **Load unpacked** →
      select unzipped folder → no warnings (AC-BD-3)
- [ ] Visit landing page `/` → click **Download extension** → ZIP downloads
      via fetch+blob (AC-BD-4)

## 1. Test sites (use each site for the row marked •)

| # | Site type            | Suggested URL                                    |
|---|----------------------|--------------------------------------------------|
| S1 | Long article         | https://en.wikipedia.org/wiki/HTTP               |
| S2 | Sticky-header dash   | https://github.com/lovable-dev (issues tab)      |
| S3 | SPA (route change)   | https://react.dev/learn                          |
| S4 | Closed shadow DOM    | https://www.youtube.com (player container)       |
| S5 | Heavy CSS (fonts)    | https://stripe.com                               |
| S6 | Disabled URL         | chrome://extensions                              |
| S7 | data: URL            | data:text/html,<h1>hi</h1>                       |

## 2. Full Page export (T1–T3)

Run on **S1** then **S2** then **S5**.

- [ ] AC-FP-1 — Click toolbar action → **Export Full Page** → a `.zip`
      downloads with name `pageport-fullpage-{domain}-{timestamp}.zip`
- [ ] AC-FP-2 — Unzip → open `page.html` directly in a new tab → renders
      visually similar to the live page (subject to host CSS/fonts)
- [ ] AC-FP-3 — `styles.css` opens, contains `/* === <source> === */`
      headers, includes both inline `<style>` and `<link>` rules
- [ ] AC-FP-4 — `scripts.js` opens, contains `/* === <source> === */`
      headers (or `/* unreachable: … */` comments for blocked URLs)
- [ ] AC-FP-5 — `screenshot.png` width = `viewportCssPx.w * dpr`,
      height ≈ `pageCssPx.h * dpr` (verify in image viewer; ≤ 5% drift OK)
- [ ] AC-FP-6 — On **S2** the sticky header appears once at top, no ghost
      copies repeated down the screenshot
- [ ] AC-FP-7 — `manifest.json` validates: `schemaVersion: 1`, `kind:
      "fullPage"`, `url`, `title`, `capturedAtIso`, `viewportCssPx`,
      `pageCssPx`, `devicePixelRatio`, `counts`, `extensionVersion`
- [ ] AC-FP-8 — Re-run on the same page; only `capturedAtIso` and
      animated-pixel diffs change (compare `manifest.json`s with diff)

## 3. Element export (T4–T7)

Run on **S1** and **S2**.

- [ ] AC-EL-1 — Click **Pick Element** → hover any element → blue outline +
      tooltip showing `tag#id.class · WxH` follows cursor
- [ ] AC-EL-2 — Right-click on a highlighted element → page's own
      contextmenu does NOT show; export starts; `.md` downloads
- [ ] AC-EL-3 — Open `.md`: contains outerHTML fenced block, "Matched
      CSS" section, "Computed styles (diff vs default)" table, two
      `data:image/...;base64,...` images (in-context + isolated)
- [ ] AC-EL-4 — On a deeply-nested element near a heavy table, file is
      ≤ 10 MiB; if degradation kicks in, top of file has truncation note
- [ ] AC-EL-5 — Re-enter picker → press **Esc** → no download triggered;
      overlay disappears; cursor returns to default

## 4. UI / flow (T9–T12, T15–T16)

- [ ] AC-UI-1 — On **S6** and **S7**: popup opens but both action buttons
      are disabled with the "Not available on browser pages." copy
- [ ] AC-UI-2 — On **S1**: popup → **Open panel on page** → floating
      panel mounts inside Shadow DOM; drag header → panel follows pointer
      and clamps to viewport edges
- [ ] AC-UI-3 — Drag panel to new position → reload page → panel
      remounts at the saved position. Change a setting (e.g. JPEG
      quality) → reload → setting persisted
- [ ] AC-UI-4 — Force an error (e.g. trigger Full Page on **S6**): panel
      shows red status row with `{message} (E_NOT_AVAILABLE_HERE)` and a
      **Copy details** button that copies a JSON blob (no page contents)
- [ ] AC-UI-5 — `Alt+Shift+E` triggers Full Page export on the active
      tab; `Alt+Shift+P` enters picker mode
- [ ] AC-UI-6 — In OS settings enable "Reduce motion" → reload → panel
      transitions and progress spinners use no/reduced motion

## 5. Robustness (T8, T10, T13)

- [ ] AC-RB-1 — On **S3**: start Full Page export, immediately click a
      nav link → export aborts with `E_ROUTE_CHANGED`, sticky elements
      are restored, scroll position restored
- [ ] AC-RB-2 — Visit a synthetic huge page
      (`data:text/html,<div style="height:99999px"></div>` is too small;
      use a real long page like
      https://html.spec.whatwg.org/multipage/) → if `pageCssPx.h * dpr` >
      32767 the export fails with `E_PAGE_TOO_LARGE`, no partial ZIP
      remains in Downloads
- [ ] AC-RB-3 — Visit a login page with `<input type="password">`
      pre-filled → Full Page export → unzip → `page.html` shows
      `value=""` (or attribute removed) for password inputs;
      non-password inputs unchanged
- [ ] AC-RB-extra — On **S4**: export Full Page; verify the page still
      captures correctly; warnings panel logs `W_SHADOW_OPEN_SKIPPED` or
      `W_IFRAME_NOT_TRAVERSED` once each (open SW DevTools)

## 7. v1.1 — Fidelity features (T19–T22)

### 7.1 Open shadow DOM walker

Test on a Lit / Spectrum / FAST / Ionic-powered page (e.g. **S4** YouTube
player chrome, https://lit.dev, https://spectrum.adobe.com).

- [ ] AC-FD-1 — Full Page export → `page.html` contains
      `<template shadowrootmode="open">` blocks for every web component
      whose chrome was visible in the live page
- [ ] AC-FD-2 — Open `page.html` in a fresh Chromium tab → web components
      render with their original markup (no empty hosts)
- [ ] AC-FD-3 — `meta.json` records the host page's open-shadow count
      (manually inspect; no UI surface yet)
- [ ] AC-FD-4 — Closed shadow roots are *not* expanded (privacy);
      verify by picking a YouTube player element — output should still
      be a bare `<video>` host

### 7.2 Constructed stylesheets (`adoptedStyleSheets`)

Test on a page using Lit (https://lit.dev/playground or any Lit demo).

- [ ] AC-FD-5 — Full Page export → unzip → `page.html` contains
      `<style data-adopted-stylesheet="true">` inside the relevant
      `<template shadowrootmode="open">`
- [ ] AC-FD-6 — Reopen `page.html` offline → host components keep their
      colors / spacing / typography (no FOUC, no broken layout)
- [ ] AC-FD-7 — Document-level `adoptedStyleSheets` (rare; check via
      `document.adoptedStyleSheets.length` in DevTools first) appear in
      `<head>` as a single `<style data-adopted-stylesheet="true">`

### 7.3 Font binary bundling

Test on **S5** (stripe.com) and any Google-Fonts-heavy page.

- [ ] AC-FD-8 — Full Page export → `page.html` opens **with no network**
      (DevTools → Network → Offline) and renders with original fonts
- [ ] AC-FD-9 — `style.css` contains `url("data:font/woff2;base64,…")`
      for every previously-CDN-hosted face
- [ ] AC-FD-10 — `meta.json.counts.fontsInlined` ≥ 1 and
      `fontsBytesInlined` is reasonable (typically 50–500 KB per family)
- [ ] AC-FD-11 — Per-font cap holds: a synthetic page referencing a
      multi-MB font keeps the original `url(...)` (no inline) and
      `fontsSkippedTooLarge` ≥ 1
- [ ] AC-FD-12 — Bundle still ≤ 1.5 MiB after the export (the budget
      governs the *extension*, not the export, but spot-check the export
      stays under 25 MB for normal pages)

### 7.4 Cross-origin iframe traversal

Test on a page with a same-origin iframe (e.g. a docs site that embeds
its own playground) **and** a page with a YouTube/Twitter embed
(cross-origin).

- [ ] AC-FD-13 — Same-origin iframe → exported `page.html` contains an
      `<iframe ... srcdoc="…" data-pageport-srcdoc="true">` with the
      sub-document fully serialized inside (verify by viewing the iframe
      in the offline export)
- [ ] AC-FD-14 — Cross-origin iframe → exported `<iframe>` has
      `data-pageport-cross-origin="true"` and an unchanged `src`
      (no srcdoc attempted)
- [ ] AC-FD-15 — Recursion stops at depth 3 (no infinite loop on a page
      that frames itself); the SW console shows no stack overflow
- [ ] AC-FD-16 — `meta.json.counts.iframesTotal /
      iframesSameOrigin / iframesCrossOrigin / iframesFailed`
      sum correctly

### 7.5 In-panel telemetry surface

Test on **S1** (article — minimal counters) and **S5** (Stripe — full
counters). Open the floating panel via popup → **Open panel on page**.

- [ ] AC-FD-17 — After a successful Full Page export the panel shows a
      "Captured in this export" block directly under the status row,
      styled with the green-tinted success surface
- [ ] AC-FD-18 — Rows are omitted when their counter is zero. On a plain
      article (no shadow DOM, no inlined fonts, no iframes) only
      "Stylesheets" and "Capture frames" appear; on Stripe all five
      labels appear (shadow roots, fonts, same/cross-origin iframes,
      stylesheets, frames)
- [ ] AC-FD-19 — The fonts row reads `N (X KB)` or `N (X.Y MB)` —
      compact units, never raw bytes; matches `meta.json.counts
      .fontsInlined` and `fontsBytesInlined`
- [ ] AC-FD-20 — Numbers in the panel match the values in the exported
      `meta.json` exactly (open both side by side)
- [ ] AC-FD-21 — On a failed export (e.g. Full Page on **S6**) the
      telemetry block is *not* rendered; only the red status row shows
- [ ] AC-FD-22 — Re-running the export updates the telemetry block in
      place; old counters do not linger from the previous run

### 7.6 Element-export telemetry parity

Test on **S1** (article — pick a paragraph) and **S5** (Stripe — pick a
pricing card with web fonts). Open the floating panel.

- [ ] AC-FD-23 — After a successful element export the same "Captured
      in this export" block appears under the status row, populated via
      the `StatusUpdate` Success broadcast (no top-level response)
- [ ] AC-FD-24 — Rows shown: `outerHTML` (bytes), `matched CSS rules`
      (count), `computed-style diffs` (count), `screenshots (context +
      isolated)` formatted as `X KB + Y KB`
- [ ] AC-FD-25 — When the offscreen render fails, the screenshot row
      reads `X KB + isolated skipped` (verify by picking on a page that
      blocks `chrome-extension://` iframes, e.g. some bank portals)
- [ ] AC-FD-26 — Numbers match the `.md` artifact: `outerHTML` bytes
      ≈ size of the fenced HTML block; `matched CSS rules` ≈ rule
      count in the "Matched CSS" section; `computed-style diffs` =
      table row count
- [ ] AC-FD-27 — Picker cancelled via Esc → no telemetry block renders
      (status returns to Idle, not Success)

## 6. Spec completeness (static review, T18-style)

- [ ] AC-SP-1 — `grep -rh "MessageKind\." extension-src` covers every
      kind listed in `spec/21-app/15-message-contracts.md`
- [ ] AC-SP-2 — No magic numbers in code (`grep -rE "[^a-zA-Z_][0-9]{3,}"
      extension-src` should only match constants files and well-known
      colors)
- [ ] AC-SP-3 — Every `ErrorCode.E_*` / `ErrorCode.W_*` thrown is listed
      in `spec/21-app/09-error-handling.md`

## 9. Smart Share — v2.2 (requires WP plugin install)

Detailed live checklist: `docs/ACCEPTANCE-v2.2.md`. Run on a throwaway
WordPress install with the `pageport` plugin v2.2.0 active.

- [ ] AC-SH-AUTH-1 — Settings → Smart Share → enter site URL → "Sign in"
      opens the hidden `pageport-bridge` admin page → on success the
      panel shows the WP display name + email
- [ ] AC-SH-AUTH-2 — Sign out from WP wp-admin → next Smart Share upload
      surfaces `E_SHARE_AUTH` and clears the cached nonce
- [ ] AC-SH-AUTH-3 — Stale nonce (wait 24h or invalidate) → upload
      surfaces `E_SHARE_AUTH`, panel offers "Sign in again"
- [ ] AC-EM-4 — Smart Share upload returns 4 URLs (`index.html`,
      `style.css`, `script.js`, `preview.png`) — `curl -fsSI` each → 200
- [ ] AC-EM-5 — Share dialog shows live 24h countdown that decrements
      each second; flips to "Expired" at 0
- [ ] AC-EM-6 — AI instruction block on clipboard references all 4 URLs
- [ ] AC-EM-7 — "Revoke now" button → all 4 URLs return 404 within 2s
- [ ] AC-SH-QUOTA-1 — Upload 31 sessions in a row as the same WP user →
      31st surfaces `E_SHARE_QUOTA`
- [ ] AC-SH-QUOTA-2 — Burst 61 uploads in <1h as the same WP user →
      61st surfaces `E_SHARE_QUOTA`
- [ ] AC-WP-1 — `wp-plugin/pageport/` v2.2.0 active; REST namespace
      `pageport/v1` responds to `/auth-status` with cookie + nonce
- [ ] AC-WP-2 — Uploaded assets land at the 4 expected paths under the
      session id; EXIF stripped from `preview.png`
- [ ] AC-WP-3 — Hourly WP cron purges expired sessions; UI shows
      "Expired" once `expires_at` < now

## Sign-off

- Tester: __________________
- Date:   __________________
- Build:  v2.2.0 (sha256 from `public/pageport.zip.sha256`)
- Result: [ ] PASS  [ ] FAIL — see notes

Notes / failures / waivers:

```


```