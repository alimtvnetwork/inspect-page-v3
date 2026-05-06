# 01 — Architecture

## Manifest V3 components
- **Service worker** (`background.ts`) — orchestrates exports, owns `chrome.tabs.captureVisibleTab`, `chrome.downloads`, and offscreen document lifecycle.
- **Content script** (`content.ts`) — injected on `<all_urls>`. Owns DOM serialization, CSS/JS collection, element picker overlay, and the floating panel mount point.
- **Floating panel** (`panel/`) — React UI rendered into a Shadow DOM root inside the content script to avoid host-page style bleed.
- **Toolbar popup** (`popup/`) — React UI for the same actions; can also command the content script to mount the floating panel.
- **Offscreen document** (`offscreen.html` + `offscreen.ts`) — holds the `<canvas>` used to stitch viewport screenshots and to render the isolated element capture. Required because MV3 service workers have no DOM.

## Message bus
All cross-context messages use a typed enum `MessageKind` and a discriminated union — never raw strings.

```text
popup ──► background ──► content (run export)
content ──► background (request capture / zip / download)
background ──► offscreen (stitch frames, render isolated element)
```

## Storage
`chrome.storage.local` for settings (image format, JPEG quality, naming pattern). No `localStorage`.
