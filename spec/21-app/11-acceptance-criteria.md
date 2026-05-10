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
- [ ] AC-EM-4 — Share Links uploads HTML/CSS/image to WordPress and copies the AI instruction block with the three public URLs.
- [ ] AC-EM-5 — Share Links button is disabled until a pairing token is saved in Settings.
- [ ] AC-EM-6 — On success an "Expires in Xh Ym" countdown chip is rendered next to the mode.

## H. WordPress backend
- [ ] AC-WP-1 — Plugin activates on WordPress 6.4+/PHP 8.1+ and creates `wp_pp_share_sessions`, `wp_pp_share_assets`, and `wp_pp_pairing_tokens`; generates `pageport_signing_key` (32 random bytes hex).
- [ ] AC-WP-2 — `POST /pageport/v1/sessions` requires `Authorization: Bearer <PPT1.…>` and returns `{session_id, expires_at, urls}`.
- [ ] AC-WP-3 — `GET /pageport/v1/share/{id}/{html|css|image}` is publicly readable until expiry/revocation, then 404.
- [ ] AC-WP-4 — Hourly cron sweep deletes files for expired sessions and marks them `Expired` (also runnable via `wp pageport cleanup`).
- [ ] AC-WP-5 — Tools → PagePort Sessions lists user's sessions (admins see all) and supports per-row + bulk Revoke.
- [ ] AC-WP-6 — Errors map to `E_SHARE_AUTH` / `E_SHARE_NETWORK` / `E_SHARE_UPSTREAM` / `E_SHARE_BAD_INPUT` / `E_SHARE_QUOTA` / `E_SHARE_BAD_TOKEN` in the panel.

## I. Pairing tokens
- [ ] AC-SH-PAIR-1 — `Tools → PagePort` mints a one-shot `PPT1.<payload>.<sig>` token and lists paired devices with revoke action.
- [ ] AC-SH-PAIR-2 — Pasting a valid token in extension Settings stores `{ pairingToken, siteUrl, tokenId, pairedAtIso }`; `siteUrl` is decoded from the token, never typed.
- [ ] AC-SH-PAIR-3 — Malformed or non-`PPT1.` input is rejected client-side with `E_SHARE_BAD_TOKEN` and never written to storage.
- [ ] AC-SH-PAIR-4 — Tampering with payload bytes invalidates the HMAC → server returns `401 E_SHARE_AUTH`; revoking a token in wp-admin yields the same response on the next request.
- [ ] AC-SH-PAIR-5 — Extension **Unpair** clears local storage; `DELETE /pairing/self` revokes the matching server-side row.
- [ ] AC-SH-QUOTA-1 — POSTing beyond `pageport_max_active_per_token` (default 30) returns `429` with code `E_SHARE_QUOTA`; the panel surfaces a clear "quota reached" message and the user can revoke old sessions to recover.

## F. Spec completeness
- [ ] AC-SP-1 — Every `MessageKind` in code has a matching entry in `15-message-contracts.md`.
- [ ] AC-SP-2 — Every numeric constant in code is declared in `20-performance-budgets.md`.
- [ ] AC-SP-3 — Every error code thrown by code appears in the `09-error-handling.md` catalog.

A release is shippable iff every box above is checked.
