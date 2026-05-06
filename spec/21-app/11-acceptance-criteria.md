# 11 — Acceptance criteria

## Full Page Export
- [ ] Clicking "Full Page" produces `page.html` containing the DOM at export time.
- [ ] `styles.css` contains all stylesheet rules (linked + inline) used by the page, with source markers.
- [ ] `scripts.js` contains all script content (linked + inline), with source markers.
- [ ] `screenshot.png` covers the full page (height ≥ scrollHeight × DPR), not just the viewport.
- [ ] All artifacts share the same timestamp in the ZIP filename and in `manifest.json`.

## Element Selection Export
- [ ] Picker mode visibly outlines hovered elements with a tooltip.
- [ ] Right-click on the highlighted element triggers export and suppresses page handlers.
- [ ] `.md` contains: outerHTML, matched CSS, computed styles, in-context Base64 screenshot, isolated Base64 screenshot.
- [ ] `.md` is downloaded automatically.

## UI / flow
- [ ] Panel reachable on any website (popup always available; injected panel on demand).
- [ ] Picker cancellable via Escape and via panel Cancel button.
- [ ] Capture errors surface in the panel with a message and copy-details action.

## Folder setup
- [ ] `spec/21-app/` exists with all files listed in the plan.
