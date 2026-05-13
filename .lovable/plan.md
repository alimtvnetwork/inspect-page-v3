# Inspect Mode — CSS-Peeper-class inspector for Inspect Page

A new third mode in the floating panel, alongside **Export Page** and **Pick Element**. All free, no sign-in required. Light theme mirrors CSS Peeper; dark theme keeps Inspect Page brand. Driven by `next` — one phase per turn.

## Ground rules

- **Brand**: "Inspect Mode" (lowercase verbs in UI). Never use PagePort/CSS Peeper in copy.
- **Storage prefix**: `inspect-page.inspect.*`
- **No backend / no auth / no Premium gate** — Contrast Scanner and element drill-down ship free.
- **Bugs we MUST avoid**: panel body always scrollable; draggable everywhere we can reach (browser chrome can't be overlaid by content scripts — covered in Phase 12 with a detached-window fallback); footer text uses semantic tokens for AA contrast in both themes; every "Export All" enumerates the full dataset, not just the visible slice.

## Phases (atomic, one per `next`)

### Phase A1 — Mode scaffolding & theme toggle
- Add `PanelMode = Export | Pick | Inspect` enum + tab switcher in panel header.
- Inspect tab renders an empty `<InspectShell>` with section placeholders (Overview, Typography, Colors, Contrast, CSS Info).
- Light/Dark theme toggle in header → writes `inspect-page.inspect.theme` to `chrome.storage.local`; CSS via `[data-lpe-theme="light|dark"]` semantic tokens (no hardcoded colors).
- Fix scroll: shell uses `overflow-y:auto; min-height:0` so body always scrolls.

### Phase A2 — Page snapshot collector (CS → SW → panel)
- New CS module `inspect/collectSnapshot.ts`: walks `document` once and returns `{ pageInfo, fonts[], colors[], cssStats, computedSamples[] }`.
- Pure, no mutation, runs on Inspect tab open + on `chrome.tabs.onUpdated` complete.
- Cached per-tab in SW.

### Phase A3 — Overview section
- Hero card: page screenshot thumb (reuse `chrome.tabs.captureVisibleTab` once), title, URL.
- "Upgrade" CTA replaced with our brand action (link to docs).

### Phase A4 — Typography section
- Group `computedSamples` by `font-family`; show heading (≥h3 or ≥24px) vs body grouping.
- Per family: family name, generic fallback chip (sans-serif/serif/mono), weight count, total text-style count.
- "Show all" → modal listing every (family, weight, size, line-height, letter-spacing) tuple with copy buttons.

### Phase A5 — Color Palette section
- Dedupe colors across `color`, `background-color`, `border-color`, `fill`, `stroke`, gradients.
- Strip first 9 swatches inline + "Show all (N)".
- Detail view: count, "Export all" (CSV + JSON, full dataset — explicit assertion that exported length === detected length), per-swatch Copy + Locate (scrolls to & flashes outline on first node using that color).

### Phase A6 — Contrast Scanner
- For every text node, compute WCAG 2.1 contrast vs effective background (walk ancestors for non-transparent bg).
- Group by (fg, bg) pair; rate Excellent / Good / Poor / Very Poor.
- Tabs: Failing | Passing. Per row: ratio, AA/AAA ✓/✗ for normal & large text, "Show details" expander.
- No paywall. No "Premium" CTA.

### Phase A7 — CSS Information section
- Style-rule count (sum across `document.styleSheets` we can read), declared CSS file size (sum of fetched stylesheet bytes), inline `<style>` count, unreachable sheet count.

### Phase A8 — Element Inspector (click-to-inspect)
- Toggle inside Inspect Mode: hover highlights, click selects (no contextmenu — left-click picks; Esc cancels).
- Right pane shows: selector path, box model (margin/border/padding/content with px), text properties (family, size, line-height, weight, letter-spacing, color + contrast badge), section colors (text/bg/border with copy + contrast), and "Show Code" button.

### Phase A9 — Show Code drawer
- Tabs: Layout | Text | Computed | Pseudo (`:hover`, `:focus`, `:active`).
- Each pane shows the matched CSS rules (reuse existing `matchedCss.ts`) with copy-rule + copy-property buttons.

### Phase A10 — Color "Locate" + gradient detail
- Locate button on any swatch scrolls into view + 1.5s outline pulse.
- For gradient swatches, detail card shows stops, angle, "Show Code" with the full `background` declaration and every selector that uses it.

### Phase A11 — Export All hardening
- Single `exportAll(dataset, format)` helper used by Colors, Typography, Contrast.
- Vitest assertion: exported row count === dataset.length for ≥3 fixture pages (catches the CSS Peeper bug).

### Phase A12 — Draggable panel + detached window fallback
- Panel header is grab handle; drag clamped to viewport.
- "Pop out" button opens a `chrome.windows.create({ type:'popup' })` detached window so the user CAN move it over the Chrome toolbar (the only way an extension can escape the tab viewport).

### Phase A13 — Footer & a11y polish
- Footer uses `text-foreground/`muted-foreground` tokens; verify ≥4.5:1 in both themes.
- Tab order, aria-labels on all icon buttons, `role="tablist"` for section tabs.

### Phase A14 — Tests, docs, packaging
- Vitest: snapshot collector, contrast math, color dedupe, exportAll completeness.
- Update `docs/QA-CHECKLIST.md` with Inspect Mode flow.
- Rebuild `public/inspect-page.zip` + sha256.

## Technical notes

- All new code under `extension-src/inspect/` and `extension-src/panel/inspect/`.
- Reuse: `matchedCss.ts`, `computedDiff.ts`, `selectorPath.ts`, `picker.ts` (overlay).
- New shared types in `extension-src/shared/types.ts`: `InspectSnapshot`, `ColorUsage`, `FontUsage`, `ContrastPair`, `CssStats`.
- CSS tokens added to `extension-src/panel/styles.css` under `[data-lpe-theme="light"]` / `[data-lpe-theme="dark"]`.
- No new permissions needed (we already have `activeTab`, `scripting`, `tabs`, `windows`).

## Out of scope (explicit)

- Sign-in, Stripe, Premium gating.
- Cloud sync of palettes.
- Figma export.
- Touching Smart Share / Export ZIP flows beyond keeping their tabs working.

---

**Remaining tasks (carried over from prior loops, still open):**
- Phase 6 manual: pen-test 4 cases, run `docs/ACCEPTANCE-v2.2.md` on prod WP, run `bash scripts/release.sh`, upload `public/inspect-page.zip` to Chrome Web Store, set `INSPECT_PAGE_WP_SITE_URL` to prod HTTPS URL.
- Deferred: Stripe Checkout → auto-flip `inspect_page_license`.

Send `next` to start **Phase A1 — Mode scaffolding & theme toggle**. Send more screenshots any time and I'll fold them into the relevant phase.
