# 26 — Implementation order (v2)

Stages run sequentially. Each "next" from the user advances one stage.

## Stage V0 — Spec freeze
Done by writing this folder. No code.

## Stage V1 — Shared groundwork
- Add `AI_INSTRUCTION_BLOCK` template + `interpolateAi(refs)` helper to `extension-src/shared/copy.ts`.
- Add `ExportFlow` enum (`FullPage` | `Element`) to `enums.ts`.
- Add `ExportArtifacts` type (html, css, js, images: `{ name, mime, base64 }[]`, meta) to `shared/types.ts`.
- Add `buildPromptMd(artifacts, refs)` pure helper under `extension-src/share/buildPromptMd.ts` (≤100 lines) + unit tests.
Verification: `vitest` green; new helper covered.

## Stage V2 — Pick Element: 4-mode toolbar
- Refactor existing `DebugPreview` toolbar to read from a single `<ExportModes flow="element" artifacts=... />` component.
- Wire MD / MD+files / ZIP buttons (Share Links rendered disabled).
- Reuse existing `JSZip` already in `ExportPanel.tsx`.
Verification: manual — pick element, all 3 buttons produce valid downloads; MD opens with images.

## Stage V3 — Full Page: 4-mode toolbar
- Reuse `<ExportModes flow="fullpage" artifacts=... />` against the `fullPageArtifacts` already returned by SW.
- Convert existing screenshot DataURL into the `images[]` shape.
- Add `prompt.md` to the auto-trigger ZIP at root (additive).
Verification: full-page export → all 3 buttons work; bundled ZIP now contains `prompt.md`.

## Stage V4 — WP plugin scaffold
- New folder `wp-plugin/pageport/` with PHP files per `25-share-links.md` §B.
- Activator creates tables + seeds enum rows.
- REST routes registered, all return 501 stubs except the seed routes.
- Add `wp-plugin/pageport.zip` packaging script `wp-plugin/scripts/package.sh`.
Verification: `php -l` clean on every file; activate locally creates tables.

## Stage V5 — WP plugin: sessions + uploads + reads
- Implement `POST /sessions`, file storage under `uploads/pageport/...`, session ID generation.
- Implement `GET /share/{id}/{kind}` with expiry check.
- Implement DELETE + LIST.
- Add hourly cron + WP-CLI `pageport cleanup`.
Verification: cURL the routes locally; expiry test by setting `expires_at` in past.

## Stage V6 — WP admin UI
- Tools → PagePort Sessions list table (`WP_List_Table`).
- Revoke action.
Verification: visible in wp-admin; revoke works.

## Stage V4' — WP scaffold + pairing tokens table  *(obsolete — superseded by V4'')*
- `wp_options`: `pageport_signing_key` (32 random bytes hex), `pageport_max_active_per_token` (default 30).
- New table `{$prefix}pp_pairing_tokens` (`tid`, `user_id`, `label`, `created_at`, `last_used_at`, `revoked_at`).
- Empty `Tools → PagePort` admin screen.

## Stage V5' — Pairing UI + Bearer middleware  *(obsolete — superseded by V5'')*
- `class-pairing.php`: mint (`PPT1.<b64url(payload)>.<b64url(hmac)>`), verify (HMAC + `tid` lookup + revocation check + `last_used_at` touch), revoke, list.
- `class-auth.php`: `require_bearer()` REST permission_callback; `wp_set_current_user` on success.
- `Tools → PagePort` screen: mint button (one-shot token display), paired-devices table, per-row revoke.

## Stage V6' — REST `/sessions` on Bearer + quota  *(obsolete — superseded by V5'')*
- Switch `/sessions` POST/LIST/DELETE permission_callback to `PagePort_Auth::require_bearer`.
- Enforce `pageport_max_active_per_token` on POST → `429 E_SHARE_QUOTA`.
- New `DELETE /pairing/self` for extension-side unpair.

## Stage V7' — Extension Settings rewrite  *(obsolete — superseded by V6''/V7'')*
- `ShareSettings = { pairingToken, siteUrl, tokenId, pairedAtIso }`.
- `parsePairingToken()` decodes payload client-side for display; signature verified by WP on every request.
- Settings panel: single token field + Pair / Unpair buttons + paired-with display.
- `createShareSession` switches to `Authorization: Bearer`; adds 429 → `E_SHARE_QUOTA` mapping.

## Stage V8' — Polish + AC  *(obsolete — superseded by V8'')*
- Error codes wired: `E_SHARE_AUTH`, `E_SHARE_NETWORK`, `E_SHARE_UPSTREAM`, `E_SHARE_BAD_INPUT`, `E_SHARE_QUOTA`, `E_SHARE_BAD_TOKEN`.
- Acceptance checklist in `11-acceptance-criteria.md` extended with AC-EX-* and AC-SH-*.
- Repackage `pageport.zip` and `pageport-wp.zip`; landing page links both and documents the pairing flow.

## Stages V4''–V8'' — v2.2 Smart Share rewrite (cookie + nonce)

Supersedes V4'–V8' (the pairing-token track is removed).

- **V4'' Auth swap** — Delete `class-pairing.php` and the
  `pp_pairing_tokens` table. Replace `require_bearer()` with
  `PagePort_Auth::require_wp_user()` (checks `is_user_logged_in()` +
  `wp_verify_nonce(.., 'wp_rest')`). Add `GET /me` returning
  `{ logged_in, user_id, display_name, email, nonce, quota }`.
  Bridge admin page (`pageport-bridge`, hidden) `postMessage`s the
  fresh nonce back to the extension.
- **V5'' Sessions on cookie + 4 files** — `POST/GET/DELETE /sessions`
  switch to `require_wp_user`. Accept `js` part. Strip EXIF on image.
  Public reads renamed to
  `/share/{id}/{index.html|style.css|script.js|preview.png}`. New
  `pp_rate_events` table; per-user **active** + **uploads/hour**
  quotas, both → `429 E_SHARE_QUOTA`.
- **V6'' Extension SW + Settings** — Drop `pairingToken` / `tokenId` /
  `pairedAtIso` from `ShareSettings`; add `userId`, `displayName`,
  `email`, `nonce`, `signedInAtIso`. New SW handlers `OpenLoginPopup`,
  `CheckShareAuth`, `RevokeShareSession`. `createShareSession` posts
  4 multipart parts with `credentials: 'include'` + `X-WP-Nonce`.
- **V7'' Share dialog** — Modal showing all 4 URLs (per-row Copy),
  live 24h countdown derived from `expires_at`, **Copy AI prompt + 4
  URLs**, **Revoke now** (calls `RevokeShareSession`).
- **V8'' Acceptance + ship** — All 95 in-sandbox tests green
  (`smokeE2E` rewritten for cookie+nonce, `buildPromptMd` updated for
  4-URL refs). Manual checklist in
  [`docs/ACCEPTANCE-v2.2.md`](../../docs/ACCEPTANCE-v2.2.md). WP plugin
  bumped to **2.2.0**; both `pageport.zip` and `pageport-wp.zip`
  repackaged; landing copy + Privacy page rewritten for the cookie
  flow.

Status: **shipped** (CHANGELOG 2.2.0, 2026-05-12).
