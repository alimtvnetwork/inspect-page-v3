# 09 — Error handling

## Rules (enforced by `10-coding-guidelines.md`)
- Every `catch` logs via `logger.error(category, message, error)`.
- Errors are NEVER swallowed. If recovery is intentional, log at `warn` level with reason.
- User-facing errors set panel status to `PanelStatus.Error` and show a one-line message + "Copy details" button.

## Categories (enum `LogCategory`)
`Capture`, `CssCollect`, `JsCollect`, `Zip`, `Download`, `Picker`, `Messaging`, `Offscreen`.

## Logging surfaces
- Service worker → `chrome://extensions` service worker DevTools.
- Content script + panel → host page DevTools console (prefixed `[llm-export]`).

## Recoverable failures
- Cross-origin CSS/JS unreachable → embed `/* unreachable: <url> */` and continue.
- A single screenshot frame fails → retry once, then abort whole export with clear error.

## If `spec/error-manage` exists later
Its rules supersede this file; this file documents the v1 baseline.
