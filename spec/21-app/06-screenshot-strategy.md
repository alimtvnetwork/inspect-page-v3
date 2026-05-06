# 06 — Screenshot strategy (scroll-and-stitch)

Owner: SW orchestrates, CS prepares the page, Offscreen owns the canvas.

## Inputs
- `pageCssPx = { w, h }` from CS (P4 in `03`).
- `viewportCssPx = { w, h }` from CS.
- `dpr = devicePixelRatio` from CS.
- `settings.imageFormat ∈ {'png','jpeg'}`, `settings.jpegQuality ∈ [60..100]`.

## Constants (declared in `20-performance-budgets.md`)
- `CAPTURE_GAP_MS = 600`
- `FRAME_SETTLE_MS = 50`
- `FRAME_SETTLE_RAFS = 2`
- `STITCH_MAX_W_PX = 16384`
- `STITCH_MAX_H_PX = 32767`
- `CAPTURE_RETRY_MAX = 1`

## A. Page preparation (CS, on `BeginScrollCapture` first call)

1. `prevScroll = { x: scrollX, y: scrollY }`.
2. Find `stuck = document.querySelectorAll('*')` filtered by `getComputedStyle(el).position ∈ {'fixed','sticky'}`. Cap to first `STICKY_SCAN_LIMIT = 5000` for perf; if exceeded log `W_STICKY_SCAN_TRUNCATED`.
3. For each `el` in `stuck`: store `{el, prevCss: el.style.cssText}`; set `el.style.visibility = 'hidden' !important` via `el.style.setProperty('visibility','hidden','important')`.
4. Disable smooth scrolling: store `prevScrollBehavior = document.documentElement.style.scrollBehavior`; set to `'auto'`.
5. Store snapshot in CS module-level `captureState` keyed by `requestId`.

## B. Per-step capture loop (SW)

```
canvasW = pageCssPx.w * dpr
canvasH = pageCssPx.h * dpr
assert canvasW <= STITCH_MAX_W_PX and canvasH <= STITCH_MAX_H_PX
   else throw E_PAGE_TOO_LARGE  (recovery: see 19/20)
steps = ceil(pageCssPx.h / viewportCssPx.h)
send OffscreenInit { widthPx: canvasW, heightPx: canvasH }
for i in 0..steps-1:
  y = min(i * viewportCssPx.h, pageCssPx.h - viewportCssPx.h)   // last step clamps
  await CS.BeginScrollCapture { y, viewportHeight: viewportCssPx.h, settleMs: FRAME_SETTLE_MS }
  await sleepUntil(lastCaptureAt + CAPTURE_GAP_MS)
  dataUrl = await captureViewportWithRetry()
  await Offscreen.OffscreenAddFrame { dataUrl, xPx: 0, yPx: y * dpr }
end for
{blobUrl,...} = await Offscreen.OffscreenStitchFinish { format, quality }
await CS.RestoreAfterCapture { requestId }
```

### `captureViewportWithRetry`
1. Try `chrome.tabs.captureVisibleTab(windowId, { format, quality })`.
2. On rejection: wait `CAPTURE_GAP_MS`, retry up to `CAPTURE_RETRY_MAX`.
3. Still failing → throw `E_CAPTURE_FAILED`.

### CS `BeginScrollCapture` step body
1. `window.scrollTo({ top: y, left: 0, behavior: 'auto' })`.
2. Await `FRAME_SETTLE_RAFS` `requestAnimationFrame` ticks.
3. `await sleep(settleMs)`.
4. Reply with `{ actualY: scrollY, dpr: devicePixelRatio }`.

If `actualY !== y` (e.g. clamped at bottom) → SW uses `actualY` when computing paste coordinate next call. Last step always clamps to `pageCssPx.h - viewportCssPx.h`.

## C. Offscreen document responsibilities

- Owns one `OffscreenCanvas(canvasW, canvasH)` per active export, keyed by `requestId`.
- `OffscreenAddFrame { dataUrl, xPx, yPx }`:
  1. `img = await createImageBitmap(await (await fetch(dataUrl)).blob())`.
  2. `ctx.drawImage(img, xPx, yPx)`.
  3. `framesPlaced++`.
- `OffscreenStitchFinish { format, quality }`:
  1. `blob = await canvas.convertToBlob({ type: 'image/'+format, quality: format==='jpeg' ? quality/100 : undefined })`.
  2. `url = URL.createObjectURL(blob)`.
  3. Return `{ blobUrl: url, widthPx: canvas.width, heightPx: canvas.height, bytes: blob.size }`.

## D. Restore (CS, on `RestoreAfterCapture`)
1. For each `{el, prevCss}` in saved state → `el.style.cssText = prevCss`.
2. `document.documentElement.style.scrollBehavior = prevScrollBehavior`.
3. `window.scrollTo(prevScroll.x, prevScroll.y)`.
4. Delete `captureState[requestId]`.

Restore MUST run even on error path (`finally`).

## E. Edge cases

| Case | Handling |
|---|---|
| Page shorter than viewport | `steps = 1`; canvas height = pageCssPx.h * dpr. |
| `pageCssPx.w > STITCH_MAX_W_PX/dpr` or height beyond cap | Throw `E_PAGE_TOO_LARGE`; surface "Page too large; try a narrower window or use Element export." |
| Lazy-loaded images | `FRAME_SETTLE_MS` + 2 RAFs; if seams persist, user may bump `FRAME_SETTLE_MS` via settings (DEFERRED to v2). |
| Animations | Documented limitation; record `W_ANIMATED_CONTENT` once per export if `prefers-reduced-motion` is false. |
| `captureVisibleTab` quota | `CAPTURE_GAP_MS = 600` keeps us under ~2/sec. |
| Sticky scan > limit | Log warning; capture proceeds (stickies above limit may ghost). |

## F. Determinism statement
Pixel output depends on host page rendering; algorithm itself is deterministic. Do not introduce randomization.
