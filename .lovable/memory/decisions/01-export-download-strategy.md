# Decision: chrome.downloads for promptable extension exports

**Context:** Inspect tab "Export report ▾" dropdown (JSON/Markdown/Colors CSV/Fonts CSV) silently did nothing when clicked from the in-page floating panel, and the user expects Chrome to ask where to save these report files.

**Root cause:** `showSaveFilePicker()` and synthetic `<a download>` clicks are unreliable from the content-script iframe used by the floating panel.

**Decision:** Route panel text/blob exports through the background `DownloadBlob` message and `chrome.downloads.download({ saveAs: true })` when the UX requires a visible Save As picker. Keep anchor download only as a last-resort fallback if the background round-trip fails.

**Side effect:** `DownloadBlob` now accepts optional `saveAs`; callers that want promptable downloads pass `saveAs: true`.

**Files:**
- `extension-src/panel/inspect/download-blob.ts` — anchor download helper (replaces picker)
- `extension-src/background.ts` — Full Page Export
- `extension-src/background/run-full-page-export.ts` — Full Page Export (orchestrator path)
- `extension-src/element/run-element-export.ts` — Element Export

**Never repeat:** Do not reintroduce `showSaveFilePicker` in any extension surface. See `.lovable/strictly-avoid.md`.
