# Inspect Page — Release Notes v2.7.5

**Milestone:** Color Tokens v2 (Dark Calendar palette format) + per-selector custom CSS.

## Highlights

- **3 variants per color** — every detected color is now emitted as a token
  with `tint` (+12% L), `base`, and `shade` (-12% L) variants. Tokens are
  named `--ip-color-N` with human labels derived from category (Surface,
  Edge, Text, Accent…).
- **v2 Dark Calendar palette MD** — exports include a `## Color tokens`
  table (Token / Human name / HEX / RGB / HSL), a `## Variants` table, and
  a per-token `## Selector map` mirroring the v2 spec.
- **Selector → token mapping** — every observed `color`, `background-color`,
  and `border` is indexed against its CSS selector (capped at 50 bindings
  per color) so the per-selector CSS file uses `var(--ip-color-N)`
  references.
- **Per-selector custom CSS** — Inspect → Colors → Tokens lets the user
  attach arbitrary CSS declarations to any selector. Persisted per
  snapshot in `chrome.storage.local` under
  `inspect-page:color-tokens:<fnv32>` keys.
- **New zip files** — every MD+files and ZIP download now drops
  `tokens.css` (`:root` token block) and `selectors.css` (per-selector
  rules + user custom CSS appended verbatim) alongside `prompt.md` /
  `index.html` / `style.css`.
- **Smart Share parity** — the four hosted share pages now receive the
  same `/* === Color tokens === */` + `/* === Per-selector tokens === */`
  CSS baked into the uploaded stylesheet.
- **Dedicated export sub-menu** — Inspect → Colors → Tokens has its own
  export menu (MD / tokens.css / selectors.css / JSON) for one-off
  hand-off to design systems.

## Technical

- New: `extension-src/inspect/colorVariants.ts`,
  `colorSelectorIndex.ts`, `colorTokenStorage.ts`,
  `colorTokensExport.ts`.
- New exporters in `inspect/exportSnapshot.ts`:
  `tokensToMarkdown`, `tokensToCssTokens`, `tokensToPerSelectorCss`,
  `tokensToJson`.
- New UI: `panel/inspect/InspectColorTokens.tsx` mounted from
  `InspectColors.tsx`.
- Shared snapshot cache extracted to
  `panel/inspect/snapshotCache.ts` so `ExportModes` can attach
  Color-Token addons without re-collecting the snapshot.
- `ExportModes` weaves `mdBlock` into single-file MD, MD+files, and
  ZIP `prompt.md`, drops `tokens.css` + `selectors.css` into both zip
  flows, and bakes the token CSS into the Smart Share payload via
  `withAddonsBakedIn`.
- 212 / 212 vitest green.

## Compat / risks

- No schema changes server-side. WP plugin unchanged (still v2.6.0).
- Storage growth is bounded — per-snapshot override keys are a tiny JSON
  blob and can be cleared with `chrome.storage.local.clear()`.
- Smart Share CSS payload grows by `tokens.css + selectors.css` bytes;
  still well under existing share size budgets.

## Files

- `public/inspect-page.zip` (manifest `version: 2.7.5`)
- `public/inspect-page.zip.sha256`