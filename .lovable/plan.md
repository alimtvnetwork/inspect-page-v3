## Goal

Two improvements:

1. **Rebrand all generated filenames** from `llm-export-*` to `pageport-*`.
2. **Bring the same atomic download options** (per-file HTML / CSS / JS, Raw or Markdown, or all-as-zip) that exist for Pick Element to the **Full Page export** flow.

---

## Part 1 — Filename rebrand (`llm-export-` → `pageport-`)

Replace the `llm-export-` prefix wherever it appears in defaults and tests. User-customized templates already saved in storage are untouched (the change only affects the defaults shipped with the extension).

Files:
- `extension-src/shared/constants.ts`
  - `DEFAULT_NAME_FULLPAGE_TEMPLATE` → `pageport-fullpage-{domain}-{timestamp}.zip`
  - `DEFAULT_NAME_ELEMENT_TEMPLATE` → `pageport-element-{domain}-{tag}-{timestamp}.md`
  - Leave `STORAGE_ROOT_KEY` and `LOG_PREFIX` alone (internal, not user-visible).
- `extension-src/zip/__tests__/filename.test.ts` — update expected strings.
- `extension-src/capture/inlineIframes.ts` + its test — only references in code comments / fixture identifiers; rename for consistency.
- `extension-src/offscreen.html` — title/identifier reference if any.
- `extension/scripts/package.sh` — output zip name stays `llm-export.zip` (that's the **distribution** zip downloaded from the landing page, separate from generated exports). Leave it. Only rename references that affect end-user generated files.
- `extension-src/panel/ExportPanel.tsx` — already uses `pageport-element-…` for the new debug downloads; keep as-is.

## Part 2 — Atomic + Markdown downloads for Full Page

Today: Full Page export builds a ZIP in the service worker and triggers a `chrome.downloads.download`. The panel only sees the resulting filename. We will:

1. **Have the SW return the raw `html`, `css`, `js` strings (and the screenshot Blob) back to the panel**, in addition to still triggering the default ZIP download.
   - Extend the `RunFullPageExport` response in `extension-src/shared/types.ts` with optional `artifacts: { html, css, js, screenshotDataUrl, meta }`.
   - In `extension-src/background.ts` (RunFullPageExport handler), include the in-memory artifacts on the response.
   - Screenshot is sent as a data URL (base64) so it survives `postMessage`.

2. **Store artifacts in panel state** (`ExportPanel.tsx`): when Success arrives with `artifacts`, set `fullPageArtifacts`.

3. **Render a `<FullPageActions/>` block under the Success status**, modeled on `DebugPreview`:
   - Format toggle: Raw / Markdown.
   - Buttons: Download HTML, Download CSS, Download JS, Download Screenshot (always raw PNG), Download All (zip).
   - Raw single-file download → `pageport-fullpage-{domain}-{ts}.{ext}`.
   - Markdown single-file → wraps the chosen content in a fenced block (`html`/`css`/`javascript`) with an H1 of the page URL.
   - "Download All (zip)" in Markdown mode produces one `page.md` with three fenced sections + screenshot + manifest, instead of separate `.html`/`.css`/`.js` files. Reuses existing `JSZip` already in `ExportPanel.tsx`.

4. **Copy strings** added to `extension-src/shared/copy.ts`:
   - `fullPageActionsHeader`, `fullPageDownloadHtml`, `fullPageDownloadCss`, `fullPageDownloadJs`, `fullPageDownloadScreenshot`, `fullPageDownloadAllZip`, plus reuse the existing `debugFormat*` strings.

5. **Styles** in `extension-src/panel/styles.css`: reuse `.lpe-debug-actions` / `.lpe-debug-fmt` patterns inside a new `.lpe-fullpage-actions` block (or just reuse the same classes wholesale).

## Out of scope

- No change to the auto-trigger download behaviour (default ZIP still drops on disk on success — the new buttons are additive).
- No change to the SW-side bundle composition.
- No changes to `extension/scripts/package.sh` distribution zip.

## Verification

- Run `vitest` (existing 70 tests + updated filename tests).
- Build + repackage via `extension/scripts/package.sh`.
- Manual: trigger Full Page export, confirm new toolbar appears post-success and each button produces the correct file with `pageport-` prefix.
