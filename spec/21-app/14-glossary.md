# 14 — Glossary

| Term | Definition |
|---|---|
| **MV3** | Manifest V3 — current Chrome extension manifest format. |
| **Service worker (SW)** | Background script in MV3. No DOM, event-driven, can be terminated by Chrome at any time. |
| **Content script (CS)** | Script injected into the host page; shares DOM, isolated JS world. |
| **Offscreen document** | Hidden DOM context owned by an MV3 extension, used here for `OffscreenCanvas` work. See `chrome.offscreen` API. |
| **Shadow DOM** | DOM subtree with style isolation; the floating panel mounts here to avoid host CSS bleed. |
| **DPR** | `window.devicePixelRatio` — physical pixels per CSS pixel. |
| **Viewport** | `innerWidth × innerHeight` — currently visible area. |
| **Sticky element** | Element with `position: sticky` that re-anchors during scroll. |
| **Fixed element** | Element with `position: fixed` that stays at viewport coords. |
| **Stitching** | Pasting captured viewport frames onto one large canvas to form a full-page image. |
| **Matched rule** | A CSS rule whose selector matches a given element via `Element.matches`. |
| **Computed style** | Final value of every CSS property as resolved by the engine (`getComputedStyle`). |
| **outerHTML** | Serialized HTML of an element including the element itself. |
| **Picker mode** | UI state where the next right-click selects the element under the cursor for export. |
| **Bundle** | The single `.zip` produced by full-page export. |
| **Artifact** | Any file produced by an export (HTML, CSS, JS, PNG, MD, ZIP). |
| **Capture frame** | One `chrome.tabs.captureVisibleTab` result. |
| **Seam** | Visible boundary in a stitched image when content moved between frames. |
| **Host page** | The website the user is currently viewing. |
| **Export pipeline** | The ordered steps from user click to downloaded file. |
| **Wire protocol** | `MessageKind` + payload contracts in `15-message-contracts.md`. |
