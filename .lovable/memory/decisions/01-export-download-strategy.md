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

---

## Amendment (2026-05-21) — Per-mode `saveAs` policy

User requested that **Export Full Page** prompt the native Chrome Save As
dialog. Other export modes keep silent download to preserve the silent-
failure fix above.

Actual on-disk policy as of this amendment:

| Export surface | `saveAs` | Path |
|---|---|---|
| **Full Page Export** (changed by this amendment) | `true` | `background/run-full-page-export.ts:190` |
| Element Export | `false` | `element/run-element-export.ts:120` |
| Panel `ExportModes` (MD-single, MD+files, ZIP, Smart Share) | `true` | via `DownloadBlob` message (`ExportModes.tsx:57`) |
| Inspect-tab "Export report ▾" (JSON / MD / CSVs) | `true` | via `DownloadBlob` message (`panel/inspect/download-blob.ts:35`) |

Rule: only flip a single call site at a time when adjusting this. Never
flip them all globally — that is what caused the original silent-failure
regression.
