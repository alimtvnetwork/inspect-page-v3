# Plan — Source-section enrichment for all export modes

Goal: every generated markdown (Element MD, MD+files zip, ZIP `prompt.md`, Smart Share AI block) gets a richer **Source** section:

```
- URL: ...
- Captured: ...
- Selector path: ...   (CSS — already there)
- XPath: ...           NEW — full XPath of picked element
- Page title: ...
- Viewport: ...
- User path: <filename chosen in Save As dialog>   NEW
- Prompt: <default prompt, editable>               NEW
- Ask user: (reserved — empty for now)             NEW (placeholder line)
- Output: (reserved — empty for now)               NEW (placeholder line)
```

Default prompt text = whatever you paste in Phase 1. Until then I'll use `TODO: <user to provide>` as a stub so I don't ship a wrong default.

---

## Phase 1 — Wire the data model (no UI yet)
- Add `xpath`, `userPath`, `prompt`, `askUser`, `output` to `BuildMarkdownInput` and to the full-page meta builder.
- Compute XPath in the element picker (`extension-src/picker/picker.ts` + `extension-src/element/selectorPath.ts`) — walk parents, `tag[nth-child]`.
- Update `extension-src/element/buildMarkdown.ts` and the full-page `prompt.md` builder + Smart Share AI block builder to render the new Source lines (skip lines whose value is empty so old behavior is preserved on full-page where there's no XPath).
- **Action needed from you in this phase:** paste the exact default prompt string. I'll bake it into `extension-src/shared/constants.ts` as `DEFAULT_AI_PROMPT`.

## Phase 2 — Capture "User path" via Save As
- Switch every download call to `chrome.downloads.download({ saveAs: true })` and listen on `chrome.downloads.onChanged` to grab the `filename.current` Chrome resolves once the user confirms.
- Problem: download happens *after* the file is built, so the filename can't go inside the file itself. Fix: write the file once with a placeholder, then on download-complete generate a sidecar `source.txt` (single small file in the same Save As) **OR** simply embed `User path: <chosen filename>` only in the Smart Share AI block which is generated server-side after download.
- I'll pick the cleanest path during implementation and confirm before shipping.

## Phase 3 — Prompt input in the panel
- Add a `<textarea>` "Prompt" in the Export panel (`extension-src/panel/ExportPanel.tsx`), prefilled with `DEFAULT_AI_PROMPT`, persisted to `chrome.storage.local` so it survives reloads.
- Pass its value into every export pipeline (element + full-page + share).

## Phase 4 — Repackage & verify
- Rebuild extension, refresh `public/inspect-page.zip` + sha256.
- Manual smoke: pick an element → Export MD → confirm Source block contains URL, Selector path, XPath, Prompt, User path (filename); Ask user / Output present but empty.
- Run vitest; fix any snapshot drift in `extension-src/element/__tests__/*` and `extension-src/share/__tests__/*`.

## Phase 5 — Update memory + release notes
- Bump extension version (v2.7.1) in `extension-src/manifest.json` + landing `WhatsNew.tsx`.
- Add a one-liner to `mem://index.md` Core noting the new Source fields are mandatory in every export.
- Add `docs/RELEASE-NOTES-v2.7.1.md`.

---

## Open question for you
**Paste the default prompt string now** (or say "use a placeholder and I'll send later") — Phase 1 needs it.

UI fixes are out of scope per your answer; will be a separate plan.

Say `next` to start Phase 1.
