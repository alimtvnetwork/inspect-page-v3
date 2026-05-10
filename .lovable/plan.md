## Goal

Enhance the Pick Element debug panel so the user can download captured element artifacts in flexible ways:

1. Download a single file (HTML only, CSS only, JS only) — per the active tab.
2. Download all three together — bundled as a ZIP.
3. Choose the output format for code files: raw (`.html` / `.css` / `.js`) **or** a Markdown (`.md`) file with fenced code blocks.

The current panel only has a single Copy button and one "Download ZIP" button. We will replace that with a clear two-axis chooser.

## UX changes (extension-src/panel/ExportPanel.tsx)

In `DebugPreview`, replace the existing `Copy` + `Download` row with a small download toolbar placed beneath the HTML/CSS/JS tab strip:

```text
Format: ( ) Raw  ( ) Markdown
[ Download current ]   [ Download all (zip) ]   [ Copy ]
```

- **Format toggle** — small segmented control (two `<button>`s) bound to local state `format: "raw" | "md"`.
- **Download current** — downloads only the currently active tab (html / css / js).
  - Raw → `pageport-element-{safe}-{ts}.{ext}` containing the raw text.
  - MD → `pageport-element-{safe}-{tab}-{ts}.md` containing a single fenced code block (` ```html `, ` ```css `, ` ```js `).
- **Download all (zip)** — always produces a ZIP.
  - Raw → `element.html`, `element.css`, `element.js`, `selector.txt` (current behavior).
  - MD → single `element.md` inside the zip with three fenced sections + selector header, plus `selector.txt`.
- **Copy** — unchanged; copies the active tab's text.

All four controls share the `lpe-btn` style; the format toggle uses `aria-pressed` for the active option. No scrollbar regressions: the toolbar wraps via the existing `.lpe-debug-tabs { flex-wrap: wrap }` rule (we'll add a sibling `.lpe-debug-actions` row with the same wrapping).

## Implementation details

1. **State** — add `const [fmt, setFmt] = useState<"raw" | "md">("raw")` inside `DebugPreview`.
2. **Helpers** (local to the component file):
   - `mimeFor(tab)` → `text/html | text/css | text/javascript`.
   - `extFor(tab)` → `html | css | js`.
   - `buildSingleMd(tab, value, selectorPath)` → returns a string with a `# Element — {selector}` header and one fenced block.
   - `buildCombinedMd(preview)` → returns a string with three fenced sections (HTML / CSS / JS) under one header.
   - `triggerDownload(blob, filename)` — extract the existing object-URL pattern so it's reused.
3. **`onDownloadCurrent`** — uses `fmt` and `tab` to produce a single-file blob, then `triggerDownload`.
4. **`onDownloadAll`** — keeps JSZip; if `fmt === "md"` write one `element.md` instead of three raw files.
5. Filenames reuse the existing `safe` selector slug + ISO timestamp pattern.

## Copy strings (extension-src/shared/copy.ts)

Add:
- `debugFormatLabel: "Format"`
- `debugFormatRaw: "Raw"`
- `debugFormatMd: "Markdown"`
- `debugDownloadCurrent: "Download current"`
- `debugDownloadAll: "Download all (zip)"`

Keep existing `debugCopy` and `debugDownload` keys (the latter becomes unused; remove it to avoid drift).

## Styles (extension-src/panel/styles.css)

Add a `.lpe-debug-actions` row: `display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:6px;` and a `.lpe-debug-fmt` segmented group styled like the existing tab buttons but smaller. No layout-width changes needed beyond the existing 360px panel.

## Build / verify

1. `cd extension && bun run build` to regenerate the bundle.
2. `bun run test` (existing 70 tests must still pass; no test changes required since this is UI-only).
3. Repackage `public/llm-export.zip` via the existing `scripts/package.sh` and refresh the SHA file.
4. User reloads the unpacked extension and verifies: Pick element → Format toggle works → "Download current" yields the correct single file in the chosen format → "Download all (zip)" yields a ZIP with either three raw files or one combined `.md`.

## Out of scope

- No changes to the SW element-export pipeline or to the existing full-page ZIP export.
- No changes to the spec'd `.md` element export (`runElementExport.ts`); the new MD here is panel-local convenience.
