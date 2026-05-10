# 22 — Test plan

## Fixture sites (canonical)

| ID | URL | Why |
|---|---|---|
| `S1` | `https://example.com/` | Tiny, no scroll. Smoke test. |
| `S2` | `https://en.wikipedia.org/wiki/Cascading_Style_Sheets` | Long page, many CSS sources. |
| `S3` | `https://stripe.com/` (or any landing with sticky header) | Sticky/fixed handling. |
| `S4` | `https://news.ycombinator.com/` | Many small elements; element picker. |
| `S5` | `https://web.dev/` | SPA navigation. |
| `S6` | A `data:text/html` URL pasted by tester | E_NOT_AVAILABLE_HERE path. |
| `S7` | A 30 000 px tall page (synthetic; reproducible HTML in repo at `extension-src/__fixtures__/tall.html` served via `vite preview`) | E_PAGE_TOO_LARGE path. |

## Test catalog

Each test has: ID, preconditions, steps, expected outcome (file shape + UI state).

### T1 — Smoke full-page (S1)
1. Open `S1`.
2. Click extension icon → click `Export Full Page`.
3. **Expect**: ZIP downloaded `pageport-fullpage-example_com-{ts}.zip`.
4. Unzip → verify presence of `page.html`, `styles.css`, `scripts.js`, `screenshot.png`, `manifest.json`, `README.txt`.
5. Open `page.html` in browser standalone → renders the example page (with some CSS via merged styles).
6. `manifest.json.kind === 'fullPage'`, `counts.captureFrames === 1`.

### T2 — Long page (S2)
1. Open `S2`. Scroll once to bottom and back to top to expand any lazy content.
2. Run Full Page export.
3. **Expect**: ZIP exists; `screenshot.png` height ≈ `pageCssPx.h * dpr`.
4. `counts.captureFrames > 1`.
5. No `E_*` in service worker DevTools; warns `W_*` allowed.

### T3 — Sticky header (S3)
1. Open `S3`.
2. Scroll mid-page (so a sticky header is in view).
3. Run Full Page export.
4. **Expect**: stitched `screenshot.png` shows the sticky header **only at the top** (not duplicated at every viewport boundary).

### T4 — Element export, simple (S1)
1. Open `S1`. Click `Pick Element`. Right-click on the `<h1>`.
2. **Expect**: `.md` downloaded, opens in VS Code preview, contains: outerHTML of `<h1>`, matched rules, computed styles, two PNG screenshots.

### T5 — Element export, deep node (S4)
1. Open `S4`. Pick a single story title link.
2. **Expect**: selector path includes `nth-of-type`. Both screenshots present. File ≤ `MD_FILE_MAX_BYTES`.

### T6 — Picker cancel (S1)
1. Click `Pick Element`. Press `Escape`.
2. **Expect**: overlay removed, status returns to Idle, no download triggered.

### T7 — Picker right-click suppression
1. On any site with a custom right-click menu, enter picker mode and right-click on an element.
2. **Expect**: extension exports; host page context menu does NOT appear.

### T8 — SPA route change (S5)
1. Start Full Page export, then immediately click an in-app link that triggers `pushState`.
2. **Expect**: `E_ROUTE_CHANGED` shown in panel; page state restored (no leftover `visibility: hidden` on stickies).

### T9 — Not-available pages (S6 + chrome://)
1. Navigate to `data:text/html,<h1>hi</h1>`.
2. Open popup.
3. **Expect**: both buttons disabled with tooltip `Not available on browser pages.`
4. Same on `chrome://newtab`.

### T10 — Page too large (S7)
1. Serve `tall.html` (30 000 px tall).
2. Run Full Page export.
3. **Expect**: panel shows `E_PAGE_TOO_LARGE` with message `Page is too large to capture. Try Element export.`. No partial download.

### T11 — Settings persistence
1. Open popup → Settings → switch to JPEG, quality 75.
2. Close popup, reopen.
3. **Expect**: settings persist. Run T1 → resulting `screenshot.png` is a JPEG inside the ZIP (still named `screenshot.png` per spec; magic bytes are JPEG).

### T12 — Panel position persistence
1. Mount panel, drag to a new position. Reload tab.
2. Mount panel again.
3. **Expect**: panel appears at the saved position (clamped to viewport).

### T13 — Password redaction
1. Visit any site with a `<input type=password>` (e.g. a login page on `S5`).
2. Run Full Page export.
3. **Expect**: in `page.html`, the password input has `value=""` and `data-redacted="true"`.

### T14 — Determinism
1. On `S1`, run T1 twice within 5 s.
2. **Expect**: `page.html`, `styles.css`, `scripts.js`, `README.txt` byte-identical (`sha256sum` matches). `manifest.json` differs only in `capturedAtIso`.

### T15 — Keyboard shortcuts
1. With popup closed, press `Alt+Shift+E` on `S1`.
2. **Expect**: Full Page export starts.

### T16 — Reduced motion
1. OS preference `prefers-reduced-motion: reduce`.
2. Mount panel.
3. **Expect**: no entrance animation; status changes are instant.

### T17 — Bundle size budget
1. After `bun run package`, check `du -h public/pageport.zip`.
2. **Expect**: ≤ `1.5 MiB`.

### T18 — Lint / unit tests
1. `bun run lint && bun run test`.
2. **Expect**: exit 0. Zero warnings.

## Smoke checklist (before any release)
`T1, T2, T4, T6, T7, T9, T11, T13, T15, T17, T18` MUST pass on Chrome stable + Edge stable.

## Out of scope
No automated browser tests in v1 (Puppeteer/Playwright deferred). All tests above are **manual scripts** the engineer or QA runs.
