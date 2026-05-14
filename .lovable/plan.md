# Inspect Page v2.5 — Pick Element Rich Inspector

Adapt the rich inspector UX shown in your reference screenshots (overlay chip with margin/padding rulers, Inspector panel with element id/classes, Text properties, Selection colors + contrast verdict, Code preview tabs with Layout/Style/Pseudo-classes) into the **Pick Element** flow of Inspect Page.

Today Pick Element ends in an export-mode toolbar. v2.5 inserts a full **Element Detail** view (same visual language as the existing Inspect tab) before/after the export toolbar, so picking an element on the page opens a dedicated inspector for that single element with copy buttons everywhere.

Driven by `next` — one phase per turn.

## Phases

### C1 — Picker chip overlay + box-model rulers
- Build the shadow-DOM overlay from `extension-src/picker/` (closes deferred B1).
- Floating chip near hovered element shows tag + `#id` + first 3 classes + `WxH` size badge.
- Dashed margin/padding rulers around the hovered element with px badges on all four sides (matches screenshot 1).
- Light/dark parity using existing CSS variables. Pure presentational; selection logic stays in `picker.ts`.

### C2 — Element snapshot collector
- New `extension-src/element/collectElementSnapshot.ts`: given the picked element, returns a serializable `ElementSnapshot` with:
  - identity (tag, id, classList, selector path, role)
  - rect + box-model (margin/padding/border per side, content w×h)
  - text properties (font-family stack, size, line-height, weight, letter-spacing, color)
  - selection colors (fg, bg resolved against ancestors)
  - matched CSS rules grouped by `:hover / :focus / :active / :disabled`
  - computed style diff vs. browser defaults, grouped (Layout, Typography, Background, Border, Effects)
- Reuses existing `matchedCss.ts`, `computedDiff.ts`, `contrast.ts`, `selectorPath.ts`.

### C3 — Inspector panel (header + box-model + text properties)
- New `extension-src/panel/element/ElementInspector.tsx` rendered when a Pick Element selection completes.
- Header: back arrow, "Inspector" title, "Show code" button (matches screenshot 2).
- Element identity card: `Button` label + colored `button.relative` selector chip.
- "Context menu while hovering" toggle (re-arms picker without leaving inspector).
- Box-model diagram (margin / border / padding / content) with live numbers.
- Text properties block: Font Family, Size, Line Height, Weight, Letter Spacing, Text color swatch + copy (matches screenshot 3).

### C4 — Selection colors + contrast verdict
- "Selection colors" section: Text + Background swatches with copy buttons.
- Contrast card: large ratio number, verdict label (Excellent/Good/Poor/Fail) with the same green pill style used today, plus AA / AAA rows for normal + large text (matches screenshot 4).
- Reuses `contrast.ts` `verdict()` helper unchanged.

### C5 — Code preview drawer
- "Show code" opens a slide-in `ElementCodeDrawer.tsx`.
- Tabs/sections: **Layout**, **Style**, **Pseudo-classes** (`:hover`, `:focus`, `:active`), each with its own copy button (matches screenshots 5, 6, 7).
- Syntax highlight via the existing lightweight tokenizer used in Show Code today (no new dep).
- "Copy all" copies a single CSS block with section comments.

### C6 — Wire export modes to the new inspector
- The existing four export-mode buttons (MD / MD+files / ZIP / Smart Share) move into a footer of the inspector view, so the user can inspect first, then export — single screen, no double back-step.
- Snapshot data is included in `prompt.md` for Smart Share (extra "Inspector summary" section) and in MD/ZIP outputs.

### C7 — Tests, docs, packaging
- Unit tests for `collectElementSnapshot` (jsdom) and the contrast/box-model formatters.
- `docs/QA-CHECKLIST.md` rows AC-PICK-INSP-1…N.
- CHANGELOG entry, version bump to 2.5.0, rebuild `inspect-page.zip` + `.sha256`.

## Out of scope for v2.5
- Editing styles in the panel (read-only inspector only).
- Cross-origin iframe drill-down (still treats iframe as a single target).
- Picker-mode keyboard navigation (stays parked in v2.4 B4).

## Remaining tasks (carryover)
1. **v2.4 plan** B1–B7 in `docs/V2.4-PLAN.md` — superseded in part by C1; remaining items (B3 distance guides, B4 keyboard nav, B5 billing telemetry, B6 pricing polish) still open.
2. **Phase 6 manual launch** — pen-tests, prod WP URL, Stripe config, Pricing polish, AC-BILL-1…5, Web Store upload, tag `v2.3.0`.
3. **v2.5 (this plan)** — C1 → C7 driven by `next`.

Send `next` to start **C1 — Picker chip overlay + box-model rulers**.
