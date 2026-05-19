# Inspect Page — Extension v2.7.2

## Multi-element picker

- Pick Element now supports selecting **up to 11 elements** in one session.
- Toggle-click adds/removes; Shift+Click also adds; Esc cancels.
- Sticky `[ Done (N) ] [ Cancel ] N/11` bar inside the picker shadow DOM.
- Persistent green outline + numbered badge for every pick, repositioned on scroll/resize.
- Inspector shows a horizontal chip strip; click a chip to focus, `×` to remove.
- Combined `.md` / `.zip` / Smart Share export emits one section per element in click order:
  - `<!-- Element N — selector -->` blocks in HTML
  - `/* Element N — selector */` blocks in CSS / JS
  - **Per-element `## Source — Element N`** block (URL, Captured ISO, Selector path, Page title, Viewport @ DPR) inserted between the AI instruction block and the HTML section in MD single, `prompt.md` (MD+files), and `prompt.md` (ZIP).

## Internals

- `StatusUpdatePayload.multiElementSnapshot[].source` added (url/capturedAtIso/pageTitle/viewport/dpr).
- `ExportArtifacts.prelude?: string` — optional markdown rendered before HTML in every export mode.
- 194/194 vitest still passing.
- `public/inspect-page.zip` + sha256 repackaged.