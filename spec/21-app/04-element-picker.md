# 04 — Element Picker

## Activation
User clicks "Pick Element" in popup or floating panel → content script enters `PickerMode.Active`.

## Hover behavior
- `mousemove` (throttled to 60fps) computes `document.elementFromPoint`.
- Highlight overlay: a single absolutely-positioned `<div>` in the picker shadow root, sized to `getBoundingClientRect()`.
- Outline: 2px solid + translucent fill.
- Tooltip near cursor: `tagName#id.class1.class2` truncated to 80 chars.

## Selection
- **Right-click** on highlighted element → fires export. `contextmenu` is captured and `preventDefault()`.
- Left-click is ignored (does not trigger the page's own handlers either — `capture: true` + `stopPropagation`).

## Cancel
- `Escape` → exits picker mode, removes overlay, restores normal cursor.
- Clicking the panel's "Cancel" button → same.

## Constraints
- Picker overlay never intercepts pointer events on the highlight box itself (`pointer-events: none`).
- Works on iframes only at the top frame in v1 (documented limitation).
