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

## Stage V7 — Extension Share Links integration
- Add Settings group `Share Links` (base URL, username, app password) + persistence.
- SW handler `CreateShareSession` (Basic auth multipart POST).
- Enable Share Links button when creds present; on click → POST → copy 3 URLs + AI block.
- Toast countdown chip.
Verification: end-to-end real WP install; URLs resolve; clipboard payload correct.

## Stage V8 — Polish + AC
- Error codes wired (`E_SHARE_AUTH`, `E_SHARE_NETWORK`, `E_SHARE_UPSTREAM`) in `09-error-handling.md`.
- Acceptance checklist in `11-acceptance-criteria.md` extended with AC-EX-* and AC-SH-*.
- Repackage `pageport.zip` and `wp-plugin/pageport.zip`; landing page links both.
