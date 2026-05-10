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

## Stage V4' — WP scaffold + pairing tokens table
- `wp_options`: `pageport_signing_key` (32 random bytes hex), `pageport_max_active_per_token` (default 30).
- New table `{$prefix}pp_pairing_tokens` (`tid`, `user_id`, `label`, `created_at`, `last_used_at`, `revoked_at`).
- Empty `Tools → PagePort` admin screen.

## Stage V5' — Pairing UI + Bearer middleware
- `class-pairing.php`: mint (`PPT1.<b64url(payload)>.<b64url(hmac)>`), verify (HMAC + `tid` lookup + revocation check + `last_used_at` touch), revoke, list.
- `class-auth.php`: `require_bearer()` REST permission_callback; `wp_set_current_user` on success.
- `Tools → PagePort` screen: mint button (one-shot token display), paired-devices table, per-row revoke.

## Stage V6' — REST `/sessions` on Bearer + quota
- Switch `/sessions` POST/LIST/DELETE permission_callback to `PagePort_Auth::require_bearer`.
- Enforce `pageport_max_active_per_token` on POST → `429 E_SHARE_QUOTA`.
- New `DELETE /pairing/self` for extension-side unpair.

## Stage V7' — Extension Settings rewrite
- `ShareSettings = { pairingToken, siteUrl, tokenId, pairedAtIso }`.
- `parsePairingToken()` decodes payload client-side for display; signature verified by WP on every request.
- Settings panel: single token field + Pair / Unpair buttons + paired-with display.
- `createShareSession` switches to `Authorization: Bearer`; adds 429 → `E_SHARE_QUOTA` mapping.

## Stage V8' — Polish + AC
- Error codes wired: `E_SHARE_AUTH`, `E_SHARE_NETWORK`, `E_SHARE_UPSTREAM`, `E_SHARE_BAD_INPUT`, `E_SHARE_QUOTA`, `E_SHARE_BAD_TOKEN`.
- Acceptance checklist in `11-acceptance-criteria.md` extended with AC-EX-* and AC-SH-*.
- Repackage `pageport.zip` and `pageport-wp.zip`; landing page links both and documents the pairing flow.
