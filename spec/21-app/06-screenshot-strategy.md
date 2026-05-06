# 06 — Screenshot Strategy

## Algorithm — scroll and stitch
1. Read `scrollWidth`, `scrollHeight`, `innerWidth`, `innerHeight`, `devicePixelRatio`.
2. Save current scroll position and the `style.cssText` of any `position: fixed` / `position: sticky` elements.
3. Hide sticky/fixed elements (`visibility: hidden`) to prevent ghosting across frames.
4. For y from 0 to `scrollHeight` step `innerHeight`:
   a. `window.scrollTo(0, y)`
   b. Wait 2 animation frames + 50 ms for lazy-loaded images.
   c. Ask the service worker to call `chrome.tabs.captureVisibleTab({ format: settings.format, quality: settings.quality })`.
   d. Send the data URL to the offscreen document with the target `(0, y * dpr)` paste coordinate.
5. Offscreen document blits each frame onto a single `OffscreenCanvas(scrollWidth*dpr, scrollHeight*dpr)`.
6. Restore sticky/fixed elements and original scroll position.
7. Return the stitched PNG/JPEG blob.

## Edge cases
- Pages shorter than viewport → single capture, no stitch.
- Animated content → unavoidable seam; documented limitation.
- `captureVisibleTab` rate-limit (max ~2/sec) → throttle with a 600 ms minimum gap.
- DPR > 1 → canvas dimensions multiplied by DPR; no manual scaling of source frames needed (they already arrive at device resolution).
