# 24 — Export modes (v2)

Status: LOCKED for v2. Applies to BOTH Full Page export and Pick Element export.

## A. The four modes

Success state of every export shows ONE toolbar with four buttons. Each is a direct action, no confirm step.

1. **MD (single file)** — one self-contained `.md`. All images embedded as base64 data URIs. The AI instruction block (§D) is the first section. No external deps. Subject to `MD_FILE_MAX_BYTES` (10 MiB); on overflow, follows the same degradation ladder defined in `05-element-export.md` P7 and emits `W_MD_TRUNCATED`.
2. **MD + files** — `.md` with relative image references plus the referenced image files, delivered as a small `.zip` (Chrome cannot drop multiple loose files in one trigger). Filename: `pageport-{flow}-{domain}-{ts}-mdfiles.zip`. Inside: `prompt.md`, `images/*.png`.
3. **ZIP** — exact bundle today's Full Page produces, plus a top-level `prompt.md` containing the AI instruction block. For Pick Element the ZIP is `index.html` + `style.css` + `images/*` + `prompt.md`.
4. **Share Links** — uploads CSS, HTML, and the primary image to the user's WordPress site via the PagePort WP plugin (`25-share-links.md`), gets back three URLs, copies to clipboard a payload = three URLs + the AI instruction block (§D) with URLs interpolated.

## B. Per-flow asset mapping

| Flow | HTML | CSS | JS | Image(s) |
|---|---|---|---|---|
| Full Page | inlined `index.html` | `style.css` | `script.js` | `screenshot.png` |
| Pick Element | `outerHTML` of selection | `matchedCss` (+ computed diff as comment block) | computed-diff JSON (informational) | context shot + isolated shot (when present) |

## C. UI placement

- Reuse `.lpe-debug-actions` pattern. Add a row above per-file Raw/Markdown buttons: `[ MD ] [ MD + files ] [ ZIP ] [ Share Links ]`.
- Share Links is **disabled** when no WP credentials saved; tooltip points to Settings → Share Links.
- Toast on every success. Share Links toast shows a 24h countdown chip while panel is open.

## D. AI instruction block (canonical)

Lives in `extension-src/shared/copy.ts` as `AI_INSTRUCTION_BLOCK`:

```
You are an expert front-end developer.
- HTML:  {{HTML_REF}}
- CSS:   {{CSS_REF}}
- Image: {{IMAGE_REF}}

Read all three. Understand the UI. Then follow the user's verbatim
instruction below and modify the CSS or HTML accordingly, including
animation. Output only the changed files.

--- USER INSTRUCTION ---
(write your instruction here)
```

Refs per mode:
- MD (single): `(see §HTML below)` / `(see §CSS below)` / `(embedded inline)`
- MD + files: `./index.html` / `./style.css` / `./images/screenshot.png`
- ZIP: same as MD + files
- Share Links: the three returned URLs

## E. Acceptance

1. Four mode buttons appear in both flows after success.
2. Single MD opens in any markdown viewer with images visible offline.
3. ZIP contains `prompt.md` at root.
4. Share Links is disabled without WP credentials.
5. Clipboard payload after Share Links matches §D with `{{*}}` filled.
