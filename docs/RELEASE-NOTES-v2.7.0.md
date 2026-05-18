# Inspect Page — Extension v2.7.0

## Highlights
- **Team Workspaces** (paired with WP plugin v2.6.0): owner/admin/member roles, email invites, per-workspace billing, workspace switcher in popup, transfer ownership.
- **Popup-only UX**: removed the in-page floating panel. Everything (Export, Inspect, Settings, Smart Share) now lives in the toolbar popup at 412×915.
- **Pick → popup flow (Option A)**: clicking "Pick element" closes the popup (Chrome MV3 limitation); after clicking an element on the page, re-open the popup and the picked element is auto-hydrated from `chrome.storage.session` (10-minute freshness window). Button flips to "Pick another element".
- **Popup geometry fix**: `.lpe-root[data-lpe-surface="popup"]` now fills the 412×915 shell (was previously locked to 600×600, clipping content).
- Dark-mint theme retained across the entire popup surface.

## Removed
- `mountFloatingPanel.tsx`, `MountFloatingPanel` message kind, `onOpenFloating` callback, moon theme toggle, "Open panel on page" button.

## Compat
- Back-compat: legacy `inspect_page_license` user meta still mirrored alongside `workspaces.license_status`.
- `listWorkspaces()` gracefully degrades on older WP plugins (404 fallback).