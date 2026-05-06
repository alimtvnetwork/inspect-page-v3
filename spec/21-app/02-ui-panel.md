# 02 — UI Panel

## Two surfaces, one component library
Both the toolbar popup and the injected floating panel render the same React component tree (`<ExportPanel />`) so behavior stays identical.

## Toolbar popup
- Opens from the extension icon.
- Buttons: **Export Full Page**, **Pick Element**, **Open panel on page**.
- Status row showing last action result.

## Floating in-page panel
- Mounted by the content script into a Shadow DOM under `<body>`.
- Draggable by header. Position persisted in `chrome.storage.local`.
- Controls: minimize, close, the two export buttons, status indicator.
- Z-index `2147483647`. Pointer-events isolated.
- Esc closes picker mode (not the panel).

## Status indicator states
`idle`, `capturing`, `bundling`, `downloading`, `success`, `error` — defined as `PanelStatus` enum.

## Settings (collapsible)
- Image format: `png` | `jpeg`.
- JPEG quality: 60–100.
- Naming pattern token list (see `07-file-naming.md`).
