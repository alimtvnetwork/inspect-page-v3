# Decision: anchor-download for extension exports

**Context:** Inspect tab "Export report ▾" dropdown (JSON/Markdown/Colors CSV/Fonts CSV) silently did nothing when clicked from the in-page floating panel.

**Root cause:** `showSaveFilePicker()` is blocked inside cross-origin iframes (the panel runs in a content-script iframe).

**Decision:** Replace `showSaveFilePicker` + `anchorFallback` with a single `anchorDownload()` helper that creates a synthetic `<a download>` and clicks it. Browser writes straight to the default Downloads folder, honoring Chrome's preference.

**Side effect:** Flipped `saveAs: true → false` on every `chrome.downloads.download` call to stop forcing the Save As… dialog.

**Files:**
- `extension-src/panel/inspect/download-blob.ts` — anchor download helper (replaces picker)
- `extension-src/background.ts` — Full Page Export
- `extension-src/background/run-full-page-export.ts` — Full Page Export (orchestrator path)
- `extension-src/element/run-element-export.ts` — Element Export

**Never repeat:** Do not reintroduce `showSaveFilePicker` in any extension surface. See `.lovable/strictly-avoid.md`.
