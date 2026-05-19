# Inspect Page — v2.7.3

## Fixed
- **Export Full Page now works on every http(s):// site again.** Previous
  versions rejected `lovable.dev`, `chatgpt.com`, `leetcode.com`, `figma.com`,
  `notion.so`, `docs.google.com`, and a few others with
  `E_NOT_AVAILABLE_HERE` ("open the preview tab", "this is an in-app editor",
  etc.). That host gating is gone — the active tab is always the target,
  exactly as the original brief specifies.

## Removed (root cause of the regression)
- `resolveFullPageExportTarget`, `findLovablePreviewTab`,
  `waitForPreviewTabReady`, `extractLovablePreviewUrlFromEditorTab`,
  `isLovableEditorUrl`, `projectIdFromLovableEditorUrl`,
  `isLikelyLovablePreviewUrl`, `scorePreviewCandidate`,
  `detectUnsupportedFullPageHost` — all deleted from `background.ts`.
- `unsupportedHost=…` / `previewTab=missing` error branches.

## Kept
- Capture-readiness retry (`ensureTabReadyForVisibleCapture` — focus window,
  poll `tab.status === "complete"`, 15 s timeout, 4 attempts via
  `CAPTURE_RETRY_MAX = 3`). Needed for `chrome.tabs.captureVisibleTab`.
- Hard-block of URLs Chrome physically forbids scripting (`chrome://`,
  `chrome-extension://`, `edge://`, `about:`, `view-source:`, `file://`,
  Web Store). Those still surface a clear error via `ensureContentScript`.

## Tests
- 194 / 194 vitest green.

## Artifacts
- `public/inspect-page.zip` (294 K) repackaged.
- `public/inspect-page.zip.sha256` refreshed.
