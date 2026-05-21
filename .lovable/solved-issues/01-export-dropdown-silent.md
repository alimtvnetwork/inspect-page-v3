# 01 — Inspect tab "Export report ▾" dropdown does nothing

## Description
User clicked Export → JSON / Markdown / Colors CSV / Fonts CSV from the Inspect tab. Nothing downloaded. Additionally, full-page and element exports were always prompting for a destination folder.

## Root Cause
1. The dropdown used `showSaveFilePicker()`, which is blocked inside cross-origin iframes — the in-page floating panel is exactly that, so the call rejected silently.
2. All `chrome.downloads.download` calls passed `saveAs: true`, which forces the Save As… dialog regardless of the user's Chrome download preference.

## Solution
- Replaced `showSaveFilePicker` + `anchorFallback` with a single `anchorDownload()` helper in `extension-src/panel/inspect/download-blob.ts` — creates a synthetic `<a download>` and clicks it.
- Flipped `saveAs: true → false` in:
  - `extension-src/background.ts`
  - `extension-src/background/run-full-page-export.ts`
  - `extension-src/element/run-element-export.ts`

## Iteration Count
1 attempt — root cause identified from the iframe context.

## Learning
Cross-origin iframes (content-script panels) block almost every "user-gesture-required" file-system API. Stick to anchor downloads or `chrome.downloads` for any download triggered from inside the panel.

## What NOT to Repeat
- Do not call `showSaveFilePicker()` from any extension surface.
- Do not set `saveAs: true` on `chrome.downloads.download` — let the user's Chrome setting decide.
