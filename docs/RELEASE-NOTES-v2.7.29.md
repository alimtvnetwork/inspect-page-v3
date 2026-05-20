# v2.7.29 — Full Page re-download Save As fix

## Fixed
- Full Page success-section buttons now open Chrome's Save As dialog instead of silently saving to the default Downloads folder:
  - HTML
  - CSS
  - JS
  - Screenshot
  - Download all ZIP
- The fix routes those buttons through the existing background `DownloadBlob` path with `chrome.downloads.download({ saveAs: true })`, matching the main ZIP and v2 export-mode buttons.

## Files
- `extension-src/panel/ExportPanel.tsx`
- `extension-src/manifest.json`, `extension/package.json` (2.7.28 → 2.7.29)
- `public/inspect-page.zip` (+ `.sha256`)