# 02 — UI Panel (popup + injected floating panel)

Two surfaces, one component (`<ExportPanel />`). All copy in `COPY` table below; no inline strings in code.

## A. Surfaces

### A1. Toolbar popup
- Opened from extension icon. Size: 320 × auto, max 480 px tall.
- Always available, even on pages where the floating panel is not mounted.

### A2. Floating in-page panel
- Mounted by CS into a Shadow DOM under `<body>` only on demand (`MountFloatingPanel`).
- Size: 320 × auto, draggable by header. Position persisted (see `16-storage-schema.md#PanelPosition`).
- Z-index `Z_INDEX_PANEL = 2147483646` (one less than picker overlay).
- Default position on first mount: `top: 16px, right: 16px` (computed as x = innerWidth - 320 - 16, y = 16).

## B. Wireframes (ASCII)

### B1. Default panel
```
┌──────────────────────────────────────────────┐
│ ≡  PagePort              ─  ✕         │  ← header (drag handle)
├──────────────────────────────────────────────┤
│  [  Export Full Page          ]              │
│  [  Pick Element              ]              │
│                                              │
│  Status: Idle                                │  ← aria-live=polite
│                                              │
│  ▸ Settings                                  │  ← collapsible
└──────────────────────────────────────────────┘
```

### B2. Capturing state
```
│  Status: Capturing  3 / 12                   │  ← progress = done/total
│  [████████░░░░░░░░░░░░]                      │
│  [ Cancel ]                                  │
```

### B3. Picker active
```
│  Picker active. Right-click an element.      │
│  Esc to cancel.                              │
│  [ Cancel picker ]                           │
```

### B4. Error state
```
│  Status: Error                               │
│  Could not capture screenshot (E_CAPTURE_…)  │
│  [ Copy details ]   [ Retry ]                │
```

### B5. Settings (expanded)
```
│  ▾ Settings                                  │
│    Image format:  ( ) PNG   ( ) JPEG         │
│    JPEG quality:  [── 90 ──]   60..100       │
│    [x] Redact <input type=password> values   │
│    [x] Include computed styles               │
│    [x] Include matched rules                 │
│    Filename — full page:                     │
│    [ pageport-fullpage-{domain}-{ts}.zip ] │
│    Filename — element:                       │
│    [ pageport-element-{domain}-{tag}-{ts} ]│
│    [ Reset to defaults ]                     │
```

## C. State machine (`PanelStatus`)

```
Idle ──ClickFullPage──▶ Collecting ──▶ Capturing ──▶ Stitching ──▶ Bundling ──▶ Downloading ──▶ Success
Idle ──ClickPick──▶ PickerActive ──▶ Selecting ──▶ Bundling ──▶ Downloading ──▶ Success
any ──cancel──▶ Idle
any ──error──▶ Error ──user click Retry──▶ (previous start state)
Success ──after SUCCESS_AUTO_DISMISS_MS=4000──▶ Idle
```

Diagram: `diagrams/panel-state.mmd`.

Status values: `Idle | Collecting | Capturing | Stitching | Bundling | Downloading | PickerActive | Selecting | Success | Error`.

## D. Copy table (single source of truth)

| Key | English text |
|---|---|
| `appName` | PagePort |
| `btnFullPage` | Export Full Page |
| `btnPick` | Pick Element |
| `btnCancel` | Cancel |
| `btnCancelPicker` | Cancel picker |
| `btnRetry` | Retry |
| `btnCopyDetails` | Copy details |
| `btnResetSettings` | Reset to defaults |
| `btnOpenPanel` | Open panel on page |
| `btnMinimize` | Minimize |
| `btnClose` | Close |
| `statusIdle` | Idle |
| `statusCollecting` | Collecting page assets… |
| `statusCapturing` | Capturing screenshot {done}/{total} |
| `statusStitching` | Stitching image… |
| `statusBundling` | Building ZIP… |
| `statusDownloading` | Downloading… |
| `statusPicker` | Picker active. Right-click an element. Esc to cancel. |
| `statusSelecting` | Building element export… |
| `statusSuccess` | Saved {filename} |
| `statusError` | Error: {message} ({code}) |
| `settingsHeader` | Settings |
| `lblImageFormat` | Image format |
| `lblJpegQuality` | JPEG quality |
| `lblRedact` | Redact `<input type=password>` values |
| `lblComputed` | Include computed styles |
| `lblMatched` | Include matched rules |
| `lblNameFull` | Filename — full page |
| `lblNameElem` | Filename — element |

All keys live in `shared/copy.ts` as a `const` object.

## E. Keyboard map

| Key | Where | Action |
|---|---|---|
| `Tab` / `Shift+Tab` | panel | Standard focus traversal. |
| `Enter` / `Space` | focused button | Activate. |
| `Escape` | picker active | Cancel picker. |
| `Escape` | settings open | Collapse settings. |
| `Escape` | success/error toast | Dismiss to Idle. |
| `Alt+Shift+E` | global (popup) | Trigger Export Full Page (`commands` API). |
| `Alt+Shift+P` | global (popup) | Trigger Pick Element. |

`commands` declared in `manifest.json` (see `12-build-and-package.md`).

## F. Focus order (panel)
1. Header drag handle (focusable, role=`button`, label "Move panel").
2. Minimize.
3. Close.
4. `Export Full Page`.
5. `Pick Element`.
6. Status region (`role="status"`, not focusable).
7. Settings disclosure.
8. (When expanded) settings controls in document order.

## G. Accessibility

- Root container `role="region"`, `aria-label="PagePort panel"`.
- Status region: `role="status" aria-live="polite" aria-atomic="true"`.
- Errors: `role="alert" aria-live="assertive"`.
- Buttons: `<button>` elements, never `<div onClick>`.
- All controls reachable by keyboard; focus visible (`outline: 2px solid hsl(var(--ring))`).
- Color contrast ≥ WCAG AA against the panel surface token.
- Reduced-motion: drag uses `transform`; no entrance animation if `prefers-reduced-motion: reduce`.

## H. Drag behavior

- Pointer down on header → start drag, store `(startX, startY, panelX, panelY)`.
- Pointer move → `x = clamp(panelX + dx, 0, innerWidth - panelW)`, `y = clamp(panelY + dy, 0, innerHeight - panelH)`.
- Pointer up → persist via `SetSettings` (debounced `STORAGE_WRITE_DEBOUNCE_MS = 250`).
- Window resize → re-clamp on next paint.

## I. Z-index and pointer-events rules

| Layer | z-index | pointer-events |
|---|---|---|
| Picker overlay (highlight box) | `2147483647` | `none` |
| Picker overlay (tooltip) | `2147483647` | `none` |
| Floating panel | `2147483646` | `auto` |
| Host page | host-defined | host-defined |

The shadow host element itself uses `pointer-events: none` so only the panel children with `pointer-events: auto` capture clicks. This prevents accidental host clicks under the panel's transparent gutter.

## J. Popup specifics
- Popup opens at `<extension icon>` location managed by Chrome. No drag, no minimize, no close (closes on blur).
- Extra row at bottom: button `btnOpenPanel` → sends `MountFloatingPanel` to the active tab.
- If active tab is `chrome://`, `chrome-extension://`, or `about:` → buttons disabled with tooltip "Not available on browser pages."

## K. What NOT to build (v1)
- No multi-select.
- No saved presets list.
- No history of past exports beyond `lastExport` in storage.
- No theming switcher (follows host design tokens automatically).
