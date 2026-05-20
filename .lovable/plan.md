## Feature: Color Tokens v2 — Variants, Selector Mapping & Custom CSS

A new first-class "Color Tokens" surface that turns each detected color into a v2-style token (HEX + RGB + HSL + 3 variants), maps it to the selectors that use it, and lets the user edit per-selector custom CSS before export. Shown in Inspect Mode and embedded in every export artifact (MD single, ZIP `prompt.md`, Smart Share, element MD).

Reference style: the v2 Dark Calendar Palette markdown the user shared — token name, human name, HEX, RGB, HSL columns, plus per-token CSS block.

---

### Phase 1 — Variant engine + selector index (pure, deterministic)

New module: `extension-src/inspect/colorVariants.ts`
- `buildToken(base: ColorUsage, index: number): ColorToken`
  - Generates `--ip-color-{index}` token, "Human name" derived from category + index (e.g. "Surface 1", "Text 2", "Accent 1"), plus 3 variants:
    - `--ip-color-{i}-tint`  → +12% L (clamped)
    - `--ip-color-{i}`       → base
    - `--ip-color-{i}-shade` → −12% L (clamped)
  - Each variant carries `{ hex, rgb, hsl, name }`. Alpha preserved.
- Pure, no DOM. Reuses `extension-src/inspect/colorMath.ts` (`parseHex`, `rgbToHsl`, formatters) — extend with `hslToHex` and a clamp helper.

New module: `extension-src/inspect/colorSelectorIndex.ts`
- `buildColorSelectorIndex(samples: ComputedSample[]): Map<string, ColorSelectorBinding[]>`
  - Walks `snapshot.computedSamples`, for each sample reads `color`, `background-color`, `border-color`, `fill`, `stroke` and records `{ selector, property, value }` per normalized hex.
  - Output: `colorHex → [{ selector, property }]`, deduped, capped at 50 selectors per color (overflow → "+N more").
- Pure. Unit-tested.

Types added to `extension-src/inspect/types.ts`:
```ts
export interface ColorVariant { name: string; hex: string; rgb: string; hsl: string }
export interface ColorToken {
  token: string;        // "--ip-color-3"
  humanName: string;    // "Accent 1"
  category: ColorCategory;
  base: ColorVariant;
  tint: ColorVariant;
  shade: ColorVariant;
  instances: number;
}
export interface ColorSelectorBinding { selector: string; property: string }
```

Tests: `colorVariants.test.ts`, `colorSelectorIndex.test.ts`.

---

### Phase 2 — Token-style exporters (pure, used by both UI and artifacts)

Extend `extension-src/inspect/exportSnapshot.ts`:
- `tokensToMarkdown(tokens, index)` → renders the **v2 Dark Calendar Palette** style:
  - `## Color tokens` table: `| Token | Human name | HEX | RGB | HSL |`
  - `## Variants` table: token + tint/base/shade columns
  - `## Selector map` section grouped per color: `--ip-color-3 — Accent 1` followed by bullet list of `selector { property }`.
- `tokensToCssTokens(tokens)` → `:root { --ip-color-1: #…; --ip-color-1-tint: #…; … }`.
- `tokensToPerSelectorCss(index, customOverrides)` → one block per selector:
  ```css
  /* Card surface */
  .card {
    --c-bg: var(--ip-color-2);
    background-color: var(--ip-color-2);
    /* user custom css if any */
  }
  ```
- `tokensToJson(tokens, index, customOverrides)` → machine-readable bundle.

Each helper is pure; thoroughly unit-tested with golden fixtures.

---

### Phase 3 — UI: Inspect → Colors → "Tokens" sub-tab

Extend `extension-src/panel/inspect/InspectColors.tsx`:
- Add third tab: `Palette / Categories / **Tokens**`.
- New component `InspectColorTokens.tsx`:
  - Token list with collapsible rows. Each row:
    - Swatch (base) + token name + human name (inline rename input — persisted).
    - HEX / RGB / HSL copy buttons.
    - "Variants" row with 3 mini-swatches (tint/base/shade) + their HEX + copy.
    - "Used by N selectors" expandable list (selector + property).
    - "Custom CSS" textarea (editable, monospace, per-selector). One per selector under the color.
  - Header: `Tokens {N}` + "Export tokens ▾" dropdown:
    - `tokens.md` (v2 palette format)
    - `tokens.css` (`:root` block)
    - `selectors.css` (per-selector blocks with custom overrides merged)
    - `tokens.json` (full bundle)
- All edits (human name overrides + per-selector custom CSS) saved per snapshot under `chrome.storage.local` key `inspect-page:color-tokens:{snapshotId}` via a thin facade in `shared/shareSettings.ts` style.

---

### Phase 4 — Embed in existing export artifacts

Hook into `extension-src/panel/ExportPanel.tsx` → `buildCombinedElementArtifacts`:
- After the existing per-element `## Source — Element N` block, append a single shared `## Color tokens` section (the same `tokensToMarkdown` output, scoped to colors observed within the picked elements).
- Append `## Custom CSS (per selector)` section using `tokensToPerSelectorCss` so the AI hand-off knows which selectors to target.
- For **ZIP** export mode also drop two files at the root of the zip:
  - `tokens.css`
  - `selectors.css`
  Wired through `extension-src/zip/buildBundle.ts`.
- For **Smart Share** the same MD blob is uploaded — no WP plugin change required (Phase 1–4 ship without touching the WP plugin).

---

### Phase 5 — Polish, tests, packaging

- Vitest: variant math, selector index, all 4 exporters, MD golden file matching the user's v2 Dark Calendar Palette format (tables exactly aligned).
- ExportPanel snapshot test asserting the `## Color tokens` block is appended in MD + ZIP + Smart Share modes.
- Update `extension-src/shared/copy.ts` with new strings.
- Rebuild `public/inspect-page.zip` + `.sha256` via `scripts/release.sh`. WP plugin zip untouched.
- Update `CHANGELOG.md` + new `docs/RELEASE-NOTES-v2.7.5.md`.
- Update memory (`mem://features/color-tokens-v2`) with the locked variant algorithm + storage key.

---

### Out of scope (explicitly not in this plan)
- AI-generated palette suggestions (user picked deterministic variant math).
- WordPress plugin changes / new REST endpoints.
- Sharing custom CSS across snapshots / users.
- Editing the *base* color hex (only variants and per-selector CSS are editable).

---

### Technical notes
- Variant L-shift uses HSL with `Math.max(4, Math.min(96, l ± 12))` to avoid pure black/white and preserve hue.
- All new code under `extension-src/` follows existing pure-module + side-effect-free conventions; no new runtime deps.
- Storage key uses `snapshotId = sha1(url + collectedAt)` (4-char hash) to avoid unbounded growth; cleared by existing `extension-src/shared/storage.ts` cleanup loop.
- Naming heuristic: per `ColorCategory` (background → "Surface", text → "Text", border → "Edge", fill/stroke → "Fill", gradient → "Gradient", other → "Color"), suffixed by occurrence rank.

---

### Phase ordering (you say "next" to advance)
1. Phase 1 — variant engine + selector index + types + tests.
2. Phase 2 — exporters + golden tests.
3. Phase 3 — Inspect Mode Tokens tab + editable CSS + storage.
4. Phase 4 — embed in MD/ZIP/Smart Share exports.
5. Phase 5 — polish, repackage, release notes.