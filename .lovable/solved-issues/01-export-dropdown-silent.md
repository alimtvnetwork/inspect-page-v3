# 01 — Inspect tab "Export report ▾" dropdown does nothing

## Description
User clicked Export → JSON / Markdown / Colors CSV / Fonts CSV from the Inspect tab. Nothing downloaded. Additionally, full-page and element exports were always prompting for a destination folder.

## Root Cause
1. The dropdown used `showSaveFilePicker()`, which is blocked inside cross-origin iframes — the in-page floating panel is exactly that, so the call rejected silently.
2. Later testing showed synthetic `<a download>` clicks can also be ignored from the floating panel iframe.

## Solution
- Replaced the Inspect report dropdown helper with a background `DownloadBlob` call using `chrome.downloads.download({ saveAs: true })`, with anchor download as last-resort fallback.
- Updated `DownloadBlob` to accept optional `saveAs` so prompt flows can ask where to save while non-prompt flows can still use the default.

## Iteration Count
1 attempt — root cause identified from the iframe context.

## Learning
Cross-origin iframes (content-script panels) block almost every "user-gesture-required" file-system API. Stick to anchor downloads or `chrome.downloads` for any download triggered from inside the panel.

## What NOT to Repeat
- Do not call `showSaveFilePicker()` from any extension surface.
- Do not use anchor download as the primary path from the floating panel; use background `chrome.downloads` instead.
