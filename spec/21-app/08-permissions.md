# 08 — Permissions

## manifest.json
```json
{
  "permissions": ["activeTab", "scripting", "downloads", "storage", "tabs", "offscreen"],
  "host_permissions": ["<all_urls>"]
}
```

## Justification
- `activeTab` + `scripting` — programmatic injection on click.
- `downloads` — write ZIP and MD to user's Downloads folder.
- `storage` — persist settings + panel position.
- `tabs` — `captureVisibleTab` on the current tab.
- `offscreen` — own a DOM context for canvas stitching outside the service worker.
- `<all_urls>` — content script must run on any site the user visits.

## Explicitly NOT requested
- `debugger` — avoided; no CDP-based screenshots in v1.
- `<all_urls>` web request access — not needed.
