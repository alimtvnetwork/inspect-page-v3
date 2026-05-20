# v2.7.28 — Full Page export polish

## Fixes
- **Screenshot no longer includes the Inspect Page panel or other browser-extension overlays.** `scrollCapture.ts` now hides Inspect Page's own hosts (`#inspect-page-*-host`) AND foreign extension overlays with `display:none !important` BEFORE the sticky/fixed scan runs. On element-dense pages this also closes a latent bug where `STICKY_SCAN_LIMIT = 5000` could starve the panel-hide path. The fallback `chrome.scripting.executeScript` path used by `screenshotOrchestrator.ts` got the same treatment.
- **Inspect Mode "Export report" (JSON / Markdown / Colors CSV / Fonts CSV) now opens a real Save As… folder picker** via `window.showSaveFilePicker`, matching the Full Page / Element export flows. Falls back to a synthetic `<a download>` click on browsers without the File System Access API. User cancellation no longer triggers a silent save.

## Notes on Full Page speed
Full Page export pacing (`CAPTURE_GAP_MS = 600`) is unchanged — Chrome's `captureVisibleTab` quota (~2/sec) dictates the floor. Long pages take ~steps × 0.7s; this is expected.

## Files
- `extension-src/capture/scrollCapture.ts`
- `extension-src/capture/screenshotOrchestrator.ts`
- `extension-src/panel/inspect/downloadBlob.ts`
- `extension-src/manifest.json`, `extension/package.json` (2.7.27 → 2.7.28)
- `public/inspect-page.zip` (+ `.sha256`)
