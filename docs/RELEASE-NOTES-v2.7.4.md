# Inspect Page — v2.7.4

## Fixed
- **Full Page screenshot capture now includes the MV3 offscreen document in the packaged extension.**
  The v2.7.3 ZIP still failed at `phase=captureFullPage` with Chrome's raw
  `Page failed to load.` because `offscreen.html` was declared in the manifest
  but was not emitted into `extension/dist/extension` or the final ZIP.

## Changed
- Added `offscreen.html` to the extension Vite entrypoints so it builds with
  `offscreen.js`.
- Added a packaging guard that fails fast if `dist/extension/offscreen.html`
  is missing, preventing this regression from shipping again.

## Tests
- 194 / 194 vitest green.

## Artifacts
- `public/inspect-page.zip` (303 K) repackaged.
- `public/inspect-page.zip.sha256` refreshed.