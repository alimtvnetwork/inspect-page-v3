# Inspect Mode — CSS-Peeper-class inspector for Inspect Page (v2)

A new third mode in the floating panel, alongside **Export Page** and **Pick Element**. All free, no sign-in required. Light theme mirrors CSS Peeper; dark theme keeps Inspect Page brand. Driven by `next` — one phase per turn.

## What the screenshots add (folded into phases below)

- **Contrast detail card** (img 11, 13): per-pair card shows ratio + verdict badge, "N instances" counter, Text and Background swatches with hex, then Normal-text / Large-text columns each with AA & AAA badges + threshold (4.5:1 / 7:1 / 3:1 / 4.5:1), Hide/Show details accordion. → **Phase A6**.
- **Contrast list** (img 12): "← Contrast Scanner" header back-button, **Failing / Passing** segmented tabs with counts, list of pair cards with ratio + verdict + instances + Show details. → **Phase A6**.
- **Colors → Categories tab** (img 15): tabs **Palette / Categories**, group headers ("Background colors 17", "Text colors", "Border colors", "Gradients"), each color row with hex + instance count + Locate (crosshair) + Copy icons; checkerboard fill = transparent. → **Phase A5 + new sub-phase A5b**.
- **Color count + Export All** (img 14): "Colors 23" header chip + **Export All** button top-right. → **Phase A5 / A11**.
- **Gradient Details drawer** (img 16): back-arrow, "Gradient Details" title, Show code button, swatch + "Linear Gradient" + "N instances", **Properties** with stop track (0% / 50% / 100%) + per-stop hex + per-stop copy, **Instances** list with chevron-expand selectors. → **Phase A10**.
- **Color instance detail** (img 17): expanded selector row showing Category, Token / Class, Value (with mini swatch), Contrast badge. → **Phase A10**.
- **Color usage drill-in** (img 18): for a flat color, expanded `div` shows Category=Text color, Value=#FFFFFF + swatch, Contrast=16.47 Excellent. → **Phase A10**.
- **Element picker label chip** (img 19): floating tag "button.relative" under cursor + tooltip ("Bookmark in history") + small icon-action button bracketed by the picker. → **Phase A8**.
- **Distance guides** (img 20): when an element is selected and the user hovers another, dashed guide lines + px badges (61px / 45px / 13px / 418px) between the two boxes — Figma-style spacing measure. → **new Phase A8b**.

## Updated phase list (atomic, one per `next`)

### Phase A1 — Mode scaffolding & theme toggle *(unchanged)*
Three-tab header (Export · Pick · Inspect), `<InspectShell>` placeholders, light/dark toggle via `[data-lpe-theme]` tokens, scrollable body fix.

### Phase A2 — Page snapshot collector *(unchanged)*
`inspect/collectSnapshot.ts` returning `{ pageInfo, fonts[], colors[], cssStats, computedSamples[], textNodes[] }`, cached per-tab.

### Phase A3 — Overview section
Hero thumbnail (single `captureVisibleTab`), title, URL. CTA = "Open docs" (no Upgrade).

### Phase A4 — Typography section
Heading vs Body grouping, family chip + generic-fallback chip ("sans-serif"), "N weights · N text styles", Show all → modal of every (family, weight, size, lh, ls).

### Phase A5 — Colors · Palette tab
"Colors {count}" header + **Export All** button. Default tab **Palette**: dedup'd swatch grid; transparent uses checkerboard; each row has Locate + Copy icons.

### Phase A5b — Colors · Categories tab *(new from img 15, 17)*
Second tab **Categories**, sections in order: Background colors, Text colors, Border colors, Fills/strokes, Gradients. Each section header has a count chip. Same row controls (Locate, Copy).

### Phase A6 — Contrast Scanner
- Top-level row in Inspect home: "Contrast Scanner {N}" with first 2–3 worst pairs + Show all.
- Detail screen: back-arrow → "Contrast Scanner" title, **Failing / Passing** segmented tabs with counts.
- Pair card: Aa swatch + ratio + verdict badge ("Excellent / Good / Poor / Very Poor"), "N instances", Show details accordion → Text hex + swatch / Background hex + swatch / Normal text [AA 4.5:1 ✓✗, AAA 7:1 ✓✗] / Large text [AA 3:1 ✓✗, AAA 4.5:1 ✓✗].
- All free; no Premium gate.

### Phase A7 — CSS Information *(unchanged)*
Style-rule count, total CSS bytes, inline `<style>` count, unreachable sheet count.

### Phase A8 — Element Inspector (click-to-inspect)
Toggle inside Inspect Mode. Hover highlight + floating selector chip ("button.relative" style), click selects, Esc cancels. Right pane: selector path, box model, text properties (with contrast badge), section colors (text/bg/border copy + contrast), Show Code button.

### Phase A8b — Distance guides *(new from img 20)*
With one element selected, hovering a second draws dashed measurement guides + px badges between the two bounding boxes (top/right/bottom/left gaps + corner offsets). Pure DOM overlay, no DevTools needed.

### Phase A9 — Show Code drawer
Tabs: Layout · Text · Computed · Pseudo (`:hover`/`:focus`/`:active`). Reuses `matchedCss.ts`. Copy-rule + copy-property buttons.

### Phase A10 — Color detail drawer (Locate + Gradient + Instance drill-in)
Back-arrow header + Show code button. For solid color: swatch + hex + "N instances" + Properties + Instances list (each row expandable to Category / Token-Class / Value / Contrast). For gradient: stop track with markers at 0/50/100%, per-stop hex + copy, Properties block, Instances list with same drill-in.

### Phase A11 — Export All hardening
Single `exportAll(dataset, format)` for Colors, Typography, Contrast (CSV + JSON). Vitest assertion: exported rows === dataset.length on ≥3 fixtures.

### Phase A12 — Draggable panel + detached-window pop-out *(unchanged)*
Header is grab handle, drag clamped; Pop-out → `chrome.windows.create({type:'popup'})` so it can sit over Chrome's chrome (only escape route for an extension).

### Phase A13 — Footer & a11y polish *(unchanged)*
Semantic-token text ≥4.5:1 both themes, aria-labels on icon buttons, `role="tablist"` everywhere with tabs.

### Phase A14 — Tests, docs, packaging *(unchanged)*
Vitest for snapshot collector, contrast math, color dedupe, exportAll completeness, distance-guide math. Update QA checklist. Rebuild `public/inspect-page.zip` + sha256.

## Technical notes

- All new code under `extension-src/inspect/` (logic) and `extension-src/panel/inspect/` (UI).
- Reuse: `matchedCss.ts`, `computedDiff.ts`, `selectorPath.ts`, picker overlay.
- New shared types: `InspectSnapshot`, `ColorUsage` (with `category: 'text'|'bg'|'border'|'fill'|'stroke'|'gradient'`, `instances: SelectorRef[]`), `FontUsage`, `ContrastPair` (with `instances`, `normalAA/AAA`, `largeAA/AAA`), `GradientStop`, `DistanceGuide`.
- Tokens added to `extension-src/panel/styles.css` under `[data-lpe-theme="light|dark"]`. Verdict colors map to existing destructive/warning/success tokens.
- No new permissions.

## Out of scope (explicit)

Sign-in · Stripe · Premium gating · cloud sync · Figma export · changes to Smart Share / Export ZIP beyond keeping their tabs working.

---

**Remaining tasks**
- Inspect Mode phases A1 → A14 (queued; A1 next)
- Carryover Phase 6 manual: pen-test 4 cases, prod acceptance, `bash scripts/release.sh`, Web Store upload, set `INSPECT_PAGE_WP_SITE_URL`
- Deferred: Stripe Checkout → auto-flip `inspect_page_license`

Send `next` to start **Phase A1**.
