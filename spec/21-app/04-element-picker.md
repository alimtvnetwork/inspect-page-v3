# 04 — Element picker

## State machine

States: `Idle | Active | Hovering | Selecting | Cancelling`.
Diagram source: `diagrams/picker-state.mmd`.

```
Idle ──EnterPickerMode──▶ Active
Active ──mousemove──▶ Hovering
Hovering ──mousemove──▶ Hovering   (update overlay rect+tooltip)
Hovering ──contextmenu──▶ Selecting
Hovering ──Escape | ExitPickerMode──▶ Cancelling ──▶ Idle
Selecting ──exportElement done──▶ Idle
Selecting ──error──▶ Idle (StatusUpdate=Error)
```

## Activation
- Trigger: `EnterPickerMode` from popup or panel.
- CS guards: if state ≠ `Idle`, ignore (idempotent).
- Side effects:
  1. Mount picker overlay root (`<div>` inside the panel's shadow root, `position:fixed; inset:0; pointer-events:none; z-index:2147483647`).
  2. Add capture-phase listeners on `window`: `mousemove`, `mouseover`, `contextmenu`, `keydown`, `click`. Each uses `{ capture: true }` and calls `e.stopPropagation()` only on `contextmenu` and `click` to avoid breaking host UX during hover.
  3. Set `document.body.style.cursor = 'crosshair'` (record previous value for restore).

## Hover behavior
- `mousemove` throttled to one event per `PICKER_THROTTLE_MS = 16` (≈60fps) using `requestAnimationFrame` coalescing.
- Resolve target: `target = document.elementFromPoint(e.clientX, e.clientY)`.
- If `target === null` or `target` is inside the panel's shadow host → hide overlay, return.
- Compute `rect = target.getBoundingClientRect()`. Update overlay box: `left/top/width/height` in px.
- Update tooltip text:
  - `tag = target.tagName.toLowerCase()`
  - `id = target.id ? '#'+target.id : ''`
  - `cls = [...target.classList].slice(0,3).map(c=>'.'+c).join('')`
  - `label = (tag+id+cls).slice(0, PICKER_TOOLTIP_MAX_CHARS=80)`
- Tooltip position: prefer `cursor + (12,12)`. If overflows viewport on right/bottom, flip to `cursor - (12+w, 12+h)`.

## Visual style (overlay)
- Outline: `2px solid hsl(var(--primary))`. Fill: `hsl(var(--primary) / 0.12)`.
- Tooltip: small chip, `background: hsl(var(--popover))`, `color: hsl(var(--popover-foreground))`, `font: 12px ui-sans-serif`, `padding: 4px 6px`, `border-radius: 4px`, `box-shadow: var(--shadow-md)`.
- All values from design tokens, no hard-coded colors.

## Selection
- `contextmenu` event:
  1. `e.preventDefault(); e.stopPropagation();`
  2. State → `Selecting`.
  3. Build payload (P1–P6 of `05-element-export.md`).
  4. Send `RunElementExport` to SW.
  5. On response → state `Idle`, exit picker.
- `click` event during `Hovering`: `e.preventDefault(); e.stopPropagation();` (consume so host page does not navigate). Do not select.

## Cancel
- `keydown` Escape: `e.preventDefault(); e.stopPropagation();` → state `Cancelling` → cleanup → `Idle`.
- Panel "Cancel" button (when in picker mode): same path via `ExitPickerMode` message.

## Cleanup (on leaving Active/Hovering)
1. Remove all capture-phase listeners.
2. Remove overlay nodes from shadow root.
3. Restore `document.body.style.cursor` to recorded value.
4. `StatusUpdate { status: Idle }`.

## Shadow-root isolation rules
- Picker overlay lives in the panel's shadow root, NOT in light DOM, so host CSS cannot affect it.
- Listeners are on `window` (not shadow root) because `elementFromPoint` for the host page must run in the light DOM context.

## Iframes (v1)
- Targets inside same-origin iframes: ignored. `elementFromPoint` returns the iframe element; we treat the iframe as the target.
- Cross-origin iframes: same.
- Document the limitation in `19-edge-cases.md`.

## Constants used
- `PICKER_THROTTLE_MS = 16`
- `PICKER_TOOLTIP_MAX_CHARS = 80`
- `Z_INDEX_PICKER = 2147483647`
