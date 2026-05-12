# 11 — Acceptance criteria (executable checklist)

Each item references a test ID in `22-test-plan.md`. An AC is satisfied iff the referenced test(s) pass.

## A. Full Page Export
- [ ] AC-FP-1 — Clicking "Export Full Page" produces a `.zip`. (T1)
- [ ] AC-FP-2 — `page.html` opens standalone and renders. (T1)
- [ ] AC-FP-3 — `styles.css` contains all readable stylesheet rules with `/* === <source> === */` headers. (T1, T2)
- [ ] AC-FP-4 — `scripts.js` contains all readable scripts with source headers. (T1, T2)
- [ ] AC-FP-5 — `screenshot.png` covers the full page (height ≈ `pageCssPx.h * dpr`). (T2)
- [ ] AC-FP-6 — Sticky/fixed elements are not ghosted across frames. (T3)
- [ ] AC-FP-7 — `manifest.json` matches the schema in `17-file-formats.md`. (T1)
- [ ] AC-FP-8 — Bundle deterministic except for `capturedAtIso` and pixel diffs from animation. (T14)

## B. Element Export
- [ ] AC-EL-1 — Picker mode highlights hovered elements with a tooltip. (T4)
- [ ] AC-EL-2 — Right-click on highlighted element triggers export and suppresses page handlers. (T7)
- [ ] AC-EL-3 — `.md` contains outerHTML, matched CSS, computed styles, two Base64 screenshots. (T4, T5)
- [ ] AC-EL-4 — `.md` is ≤ `MD_FILE_MAX_BYTES`; truncation note added if degraded. (T5)
- [ ] AC-EL-5 — Escape cancels picker without downloading. (T6)

## C. UI / Flow
- [ ] AC-UI-1 — Popup available on all normal pages; disabled with tooltip on `chrome://`, `data:`, `about:`. (T9)
- [ ] AC-UI-2 — Floating panel can be mounted from popup and dragged within viewport. (T12)
- [ ] AC-UI-3 — Panel position and settings persist across reloads. (T11, T12)
- [ ] AC-UI-4 — Errors surface in panel with code, message, and Copy details. (T10)
- [ ] AC-UI-5 — Keyboard shortcuts trigger exports. (T15)
- [ ] AC-UI-6 — Reduced motion respected. (T16)

## D. Robustness
- [ ] AC-RB-1 — SPA route change mid-export aborts cleanly and restores page state. (T8)
- [ ] AC-RB-2 — Pages exceeding canvas limits fail with `E_PAGE_TOO_LARGE` and no partial file. (T10)
- [ ] AC-RB-3 — Password fields redacted by default in `page.html`. (T13)

## E. Build / Distribution
- [ ] AC-BD-1 — `bun run lint` and `bun run test` both exit 0. (T18)
- [ ] AC-BD-2 — `bun run package` produces `public/pageport.zip` ≤ `1.5 MiB` with sidecar `.sha256`. (T17)
- [ ] AC-BD-3 — `chrome://extensions` → Load unpacked succeeds with zero warnings.
- [ ] AC-BD-4 — Lovable landing page downloads the ZIP via fetch+blob. (manual: visit `/`, click Download.)
- [ ] AC-BD-5 — `wp-plugin/scripts/package.sh` produces `public/pageport-wp.zip` with sidecar `.sha256`.
- [ ] AC-BD-6 — Landing page exposes the WP plugin download alongside the extension ZIP.

## G. Export modes
- [ ] AC-EM-1 — Both flows expose all four modes: MD single, MD+files, ZIP, Share Links.
- [ ] AC-EM-2 — MD single inlines images as base64; MD+files emits a zip with `index.md` and `assets/`.
- [ ] AC-EM-3 — ZIP mode includes `prompt.md` with the AI instruction block.
- [ ] AC-EM-4 — Smart Share uploads HTML/CSS/JS/image to WordPress and the resulting Share dialog can copy the AI instruction block with the four public URLs (`index.html`, `style.css`, `script.js`, `preview.png`).
- [ ] AC-EM-5 — Share Links button is disabled until the user is signed in to WordPress (Settings → Smart Share).
- [ ] AC-EM-6 — After Smart Share success the Share dialog renders a live `Expires in Xh Ym Zs` countdown derived from `expires_at`, switching to "Expired" at 0.
- [ ] AC-EM-7 — Share dialog **Revoke now** calls `DELETE /sessions/{id}`; subsequent fetches of the four URLs return 404.

## H. WordPress backend
- [ ] AC-WP-1 — Plugin activates on WordPress 5.6+/PHP 7.4+ and creates `wp_pp_share_sessions`, `wp_pp_share_assets`, the three enum tables, and `wp_pp_rate_events`.
- [ ] AC-WP-2 — `POST /pageport/v1/sessions` requires the WP login cookie + `X-WP-Nonce` and returns `{session_id, expires_at, urls:{html,css,js,image}}`.
- [ ] AC-WP-3 — `GET /pageport/v1/share/{id}/{index.html|style.css|script.js|preview.png}` is publicly readable until expiry/revocation, then 404.
- [ ] AC-WP-4 — Hourly cron sweep deletes files for expired sessions and marks them `Expired` (also runnable via `wp pageport cleanup`).
- [ ] AC-WP-5 — Tools → PagePort Sessions lists user's sessions (admins see all) and supports per-row + bulk Revoke.
- [ ] AC-WP-6 — Errors map to `E_SHARE_AUTH` / `E_SHARE_NETWORK` / `E_SHARE_UPSTREAM` / `E_SHARE_BAD_INPUT` / `E_SHARE_QUOTA` in the panel.
- [ ] AC-WP-7 — `GET /pageport/v1/auth-status` returns `{ logged_in, user_id, display_name, email, nonce, quota }` for the cookie-bearing user.

## I. Sign-in (cookie + nonce)
- [ ] AC-SH-AUTH-1 — Settings → Smart Share has a single text field (site URL) and a **Sign in** button; pressing it opens `…/wp-admin/admin.php?page=pageport-bridge` in a new tab.
- [ ] AC-SH-AUTH-2 — After WP login the bridge page `postMessage`s the fresh `wp_rest` nonce + identity back; the SW persists `{ siteUrl, userId, displayName, email, nonce, signedInAtIso }` and the panel shows "Signed in as …".
- [ ] AC-SH-AUTH-3 — A bad/missing nonce, or a logged-out cookie, returns `401` from `/sessions` → panel maps to `E_SHARE_AUTH` AND clears the cached `nonce` / `userId` so the user is prompted to sign in again.
- [ ] AC-SH-AUTH-4 — Extension **Sign out** clears the cached identity locally; the WP cookie itself is untouched.
- [ ] AC-SH-QUOTA-1 — POSTing beyond `pageport_max_active_per_user` (default 30) returns `429` with code `E_SHARE_QUOTA`; the panel surfaces a clear "quota reached" message and revoking old sessions in wp-admin (or via the Share dialog) restores upload capacity.
- [ ] AC-SH-QUOTA-2 — Exceeding `pageport_max_uploads_per_hour` (default 60) within a rolling hour returns the same `429 E_SHARE_QUOTA`; `pp_rate_events` rows older than 2h are pruned hourly.

## F. Spec completeness
- [ ] AC-SP-1 — Every `MessageKind` in code has a matching entry in `15-message-contracts.md`.
- [ ] AC-SP-2 — Every numeric constant in code is declared in `20-performance-budgets.md`.
- [ ] AC-SP-3 — Every error code thrown by code appears in the `09-error-handling.md` catalog.

A release is shippable iff every box above is checked.
