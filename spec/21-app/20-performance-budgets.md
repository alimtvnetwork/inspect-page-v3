# 20 — Performance budgets and constants

All numeric constants used anywhere in the extension live here. Source of truth. Each is exported from `shared/constants.ts`. No magic numbers in code or in other spec files — they reference these by name.

## Timeouts (ms)

| Constant | Value | Used in |
|---|---|---|
| `PING_TIMEOUT_MS` | 1 000 | Health checks, version handshake. |
| `COLLECT_TIMEOUT_MS` | 30 000 | `CollectPageArtifacts`. |
| `SCROLL_STEP_TIMEOUT_MS` | 5 000 | `BeginScrollCapture`. |
| `CAPTURE_TIMEOUT_MS` | 3 000 | `chrome.tabs.captureVisibleTab`. |
| `OFFSCREEN_FRAME_TIMEOUT_MS` | 2 000 | `OffscreenAddFrame`. |
| `STITCH_FINISH_TIMEOUT_MS` | 15 000 | `OffscreenStitchFinish`. |
| `ISOLATED_LOAD_TIMEOUT_MS` | 5 000 | iframe `srcdoc` load. |
| `ISOLATED_RENDER_TIMEOUT_MS` | 10 000 | `OffscreenRenderIsolated`. |
| `EXPORT_FULL_TIMEOUT_MS` | 120 000 | Overall full-page export. |
| `EXPORT_ELEMENT_TIMEOUT_MS` | 30 000 | Overall element export. |
| `KEEPALIVE_INTERVAL_MS` | 25 000 | SW alarm during active export. |

## Throttles & settle

| Constant | Value | Used in |
|---|---|---|
| `CAPTURE_GAP_MS` | 600 | Min gap between `captureVisibleTab` calls. |
| `FRAME_SETTLE_MS` | 50 | Wait after scroll before capture. |
| `FRAME_SETTLE_RAFS` | 2 | Animation frames awaited before capture. |
| `PICKER_THROTTLE_MS` | 16 | Picker `mousemove` coalescing. |
| `STORAGE_WRITE_DEBOUNCE_MS` | 250 | Settings/panel-position writes. |
| `SUCCESS_AUTO_DISMISS_MS` | 4 000 | Panel returns to Idle. |

## Sizes & limits

| Constant | Value | Notes |
|---|---|---|
| `STITCH_MAX_W_PX` | 16 384 | Hard cap on canvas width (Chromium safe). |
| `STITCH_MAX_H_PX` | 32 767 | Hard cap on canvas height (Chromium safe). |
| `STICKY_SCAN_LIMIT` | 5 000 | Max DOM nodes inspected for sticky/fixed. |
| `SELECTOR_MAX_DEPTH` | 12 | Max ancestors in element selector path. |
| `PICKER_TOOLTIP_MAX_CHARS` | 80 | Tooltip text length cap. |
| `MD_IMAGE_MAX_BYTES` | 2 097 152 | 2 MiB per Base64 image in `.md`. |
| `MD_FILE_MAX_BYTES` | 10 485 760 | 10 MiB total `.md` budget. |
| `CAPTURE_RETRY_MAX` | 1 | Retries per failed `captureVisibleTab`. |
| `Z_INDEX_PICKER` | 2 147 483 647 | Picker overlay. |
| `Z_INDEX_PANEL` | 2 147 483 646 | Floating panel. |

## Format defaults

| Constant | Value |
|---|---|
| `DEFAULT_IMAGE_FORMAT` | `'png'` |
| `DEFAULT_JPEG_QUALITY` | 90 |
| `ZIP_COMPRESSION_LEVEL` | 6 |

## Filenames

| Constant | Value |
|---|---|
| `DEFAULT_NAME_FULLPAGE_TEMPLATE` | `'inspect-page-fullpage-{domain}-{timestamp}.zip'` |
| `DEFAULT_NAME_ELEMENT_TEMPLATE` | `'inspect-page-element-{domain}-{tag}-{timestamp}.md'` |
| `FILENAME_MAX_CHARS` | 120 (excluding extension) |

## Performance targets (acceptance, not enforcement)

| Scenario | Target |
|---|---|
| Full-page export, 1920×4000 page | ≤ 8 s on a 2020 mid-range laptop. |
| Full-page export, 1920×16000 page | ≤ 25 s. |
| Element export | ≤ 5 s. |
| Panel mount on host page | ≤ 200 ms after click. |
| Picker hover response | ≤ 32 ms (≈ two frames). |

## Fallbacks when budgets exceed

- `pageCssPx.h * dpr > STITCH_MAX_H_PX` → `E_PAGE_TOO_LARGE`. Suggest user use Element export.
- `MD_FILE_MAX_BYTES` exceeded → degrade per `05-element-export.md` P7.
- `CAPTURE_GAP_MS` rate-limit hit → automatic retry once after `CAPTURE_GAP_MS`.

## Bundle size budget (built artifact)

| Asset | Budget |
|---|---|
| `background.js` | ≤ 200 KiB minified. |
| `content.js` | ≤ 200 KiB minified. |
| `popup.html` + JS + CSS | ≤ 250 KiB total. |
| `panel.js` (injected) | ≤ 250 KiB minified. |
| `offscreen.html` + JS | ≤ 200 KiB total. |
| Final ZIP `public/inspect-page.zip` | ≤ 1.5 MiB. |

If a budget is breached, the implementing AI MUST flag it in the build log and either remove a dep or split. Do not silently exceed.
