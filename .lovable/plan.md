# Inspect Mode — CSS-Peeper-class inspector for Inspect Page (v3)

A new third mode in the floating panel, alongside **Export Page** and **Pick Element**. All free, no sign-in required. Light theme mirrors CSS Peeper; dark theme keeps Inspect Page brand. Driven by `next` — one phase per turn.

## Reference screenshots (folded into phases below)

**Overview / sections (round 1)**
- Header with Inspect Mode toggle, Overview, page thumbnail, title + URL → A1 / A3
- Typography: Headings + Body cards, family + generic chip, "N weights · N text styles" → A4
- Color Palette swatch row + Show all → A5
- Contrast Scanner row with count badge → A6
- CSS Information (Style Rules, CSS file size) → A7

**Contrast detail / list (round 2)**
- Pair card: ratio + verdict, "N instances", Text/Background swatches + hex, Normal/Large × AA/AAA badges, Hide/Show details accordion → A6
- "← Contrast Scanner" detail screen with Failing/Passing segmented tabs + counts → A6

**Colors deep-dive (round 2)**
- "Colors {N}" header + Export All button → A5 / A11
- Palette / Categories tabs, "Background colors 17", "Text colors", "Border colors", per-row Locate + Copy, transparent = checkerboard → A5b
- Gradient Details drawer: back-arrow, Show code, swatch + "Linear Gradient" + N instances, Properties (stop track 0/50/100%, per-stop hex + copy), Instances list → A10
- Color instance row expanded: Category / Token-Class / Value / Contrast → A10
- Solid color drill-in: Category=Text color, Value=#FFFFFF + swatch, Contrast=16.47 Excellent → A10

**Picker overlay (round 2)**
- Floating selector chip "button.relative" under cursor + tooltip + small action icon → A8
- Distance guides between selected + hovered: dashed lines, px badges (61px / 45px / 13px / 418px) → A8b

**Inspector right pane (round 3 — NEW)**
- Inspector header: back-arrow + "Inspector" title + Show code button → **A8**
- Element label block: tagName "Button" + selector "button.relative" (highlighted token) → **A8**
- "Context menu while hovering" toggle (when on, right-click pages context menu still works while picker active) → **A8 (new control)**
- Box-model diagram (CSS Peeper style): nested margin → border → padding → content rectangles, numbers in each gap edge ("1", "1", "-", "-") and inner content size pill (`28 X 28`); `-` means 0/auto → **A8**
- Text properties block: rows for Font Family (ellipsis-truncated, copy-all on click), Font Size, Line Height, Font Weight ("Regular (400)"), Letter Spacing, Text color (swatch + hex + copy), Contrast (ratio + verdict badge) → **A8**
- Selection colors block (separate from Text properties): Text card + Background card (hex + copy), then Contrast card showing big ratio + verdict + Normal/Large × AA/AAA grid → **A8**

**Show Code drawer (round 3 — NEW)**
- Header: back-arrow + "Code preview" title → **A9**
- Subsection cards each with title + copy-all icon and syntax-highlighted CSS body. Confirmed subsections:
  - **Layout** (positioning, box, flex/grid, sizing, padding/margin) → A9
  - **Style** (full computed style dump, scrollable) → A9
  - **PSEUDO-CLASSES** group → cards labeled `:hover (Style)`, `:focus (Style)`, `:active (Style)`, each with its own copy → **A9 (rename pseudo tab → expandable group)**
- Syntax highlighting: property = blue, value-keyword = white, function/var = orange, punctuation = white. Use a tiny built-in tokenizer (no Prism dep) to keep extension bundle small.

## Updated phase list (atomic, one per `next`)

### A1 — Mode scaffolding & theme toggle
Three-tab header (Export · Pick · Inspect), `<InspectShell>` placeholders, light/dark toggle via `[data-lpe-theme]` tokens, scrollable body fix.

### A2 — Page snapshot collector
`inspect/collectSnapshot.ts` → `{ pageInfo, fonts[], colors[], cssStats, computedSamples[], textNodes[] }`. Cached per-tab.

### A3 — Overview section
Hero thumbnail (single `captureVisibleTab`), title, URL. CTA = "Open docs".

### A4 — Typography section
Heading vs Body grouping, family + generic-fallback chip, "N weights · N text styles", Show all modal.

### A5 — Colors · Palette tab
"Colors {N}" header + Export All. Dedup'd swatch grid; transparent = checkerboard; row Locate + Copy.

### A5b — Colors · Categories tab
Tabs Palette / Categories. Sections: Background, Text, Border, Fill/Stroke, Gradient. Each header has count chip; rows reuse Locate/Copy.

### A6 — Contrast Scanner
Inspect-home row with worst pairs + Show all. Detail screen: back-arrow + Failing/Passing tabs. Pair card: ratio, verdict, instances, Show details → Text/Background swatches + Normal/Large × AA/AAA grid.

### A7 — CSS Information
Style-rule count, total CSS bytes, inline `<style>` count, unreachable sheet count.

### A8 — Element Inspector right pane *(expanded)*
Click-to-inspect toggle inside Inspect Mode. On select, panel switches to Inspector view with:
- Header: back-arrow + "Inspector" + **Show code** button
- Element label: `tagName` + selector chip (purple token = tag, white = class/id)
- **"Context menu while hovering"** toggle (default OFF; ON re-enables native right-click while picker active)
- **Box-model diagram** SVG (margin/border/padding/content nested rects + inline numbers + center size pill)
- **Text properties** rows (only rendered when element has direct text)
- **Selection colors** (Text + Background swatches + Contrast card with full AA/AAA grid)
Reuses `selectorPath.ts`, `computedDiff.ts`. New helper `boxModelDiagram.tsx`.

### A8b — Distance guides
Selected + hovered → dashed measurement lines + px badges (top/right/bottom/left + corner offsets). DOM overlay only.

### A9 — Show Code drawer *(expanded)*
Opens from Show code button. Header: back-arrow + "Code preview". Subsection cards in this order:
1. **Layout** — position/display/sizing/spacing/flex/grid only (curated subset)
2. **Style** — full computed style dump (scrollable, monospace)
3. **PSEUDO-CLASSES** group: `:hover (Style)`, `:focus (Style)`, `:active (Style)` — each its own card with copy-all
Each card: title left, copy-all icon right, syntax-highlighted CSS body. Built-in mini tokenizer (props blue, vars/functions orange, values white). Reuses `matchedCss.ts` for matched-rule data.

### A10 — Color detail drawer (Locate + Gradient + Instance drill-in)
Solid: swatch + hex + N instances + Properties + expandable Instance rows (Category / Token-Class / Value / Contrast). Gradient: back-arrow + "Gradient Details" + Show code + stop track + per-stop hex/copy + Instances drill-in.

### A11 — Export All hardening
Single `exportAll(dataset, format)` for Colors, Typography, Contrast (CSV + JSON). Vitest: exported rows === dataset.length on ≥3 fixtures.

### A12 — Draggable panel + detached-window pop-out
Header grab handle, drag clamped; Pop-out → `chrome.windows.create({type:'popup'})` so it can sit over Chrome's chrome.

### A13 — Footer & a11y polish
Semantic-token text ≥4.5:1 both themes, aria-labels on icon buttons, `role="tablist"` for tabs.

### A14 — Tests, docs, packaging
Vitest: snapshot, contrast math, color dedupe, exportAll completeness, distance-guide math, box-model math. Update QA checklist. Rebuild `public/inspect-page.zip` + sha256.

## Technical notes

- All new code under `extension-src/inspect/` (logic) and `extension-src/panel/inspect/` (UI).
- New shared types: `InspectSnapshot`, `ColorUsage` (with `category`, `instances`), `FontUsage`, `ContrastPair` (with `instances`, AA/AAA flags), `GradientStop`, `BoxModel`, `DistanceGuide`.
- Built-in CSS syntax highlighter (~80 LoC, no Prism) — colors driven by theme tokens.
- Tokens added to `extension-src/panel/styles.css` under `[data-lpe-theme="light|dark"]`.
- No new permissions.

## Out of scope

Sign-in · Stripe · Premium gating · cloud sync · Figma export · changes to Smart Share / Export ZIP beyond keeping their tabs working.

---

**Remaining tasks**
- Inspect Mode phases A1 → A14 (A1 next)
- Carryover Phase 6 manual: pen-test 4 cases, prod acceptance, `bash scripts/release.sh`, Web Store upload, set `INSPECT_PAGE_WP_SITE_URL`
- Deferred: Stripe Checkout → auto-flip `inspect_page_license`

Send `next` to start **Phase A1**.
