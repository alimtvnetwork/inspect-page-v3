# 24 — Export modes (v2)

Status: LOCKED for v2. Applies to BOTH Full Page export and Pick Element export.

## A. The four modes

Success state of every export shows ONE toolbar with four buttons. Each is a direct action, no confirm step.

1. **MD (single file)** — one self-contained `.md`. All images embedded as base64 data URIs. The AI instruction block (§D) is the first section. No external deps. Subject to `MD_FILE_MAX_BYTES` (10 MiB); on overflow, follows the same degradation ladder defined in `05-element-export.md` P7 and emits `W_MD_TRUNCATED`.
2. **MD + files** — `.md` with relative image references plus the referenced image files, delivered as a small `.zip` (Chrome cannot drop multiple loose files in one trigger). Filename: `pageport-{flow}-{domain}-{ts}-mdfiles.zip`. Inside: `prompt.md`, `images/*.png`.
3. **ZIP** — exact bundle today's Full Page produces, plus a top-level `prompt.md` containing the AI instruction block. For Pick Element the ZIP is `index.html` + `style.css` + `images/*` + `prompt.md`.
4. **Smart Share** (label "Share Links" in the toolbar) — uploads HTML, CSS, JS, and the primary image to the user's WordPress site via the PagePort WP plugin (`25-share-links.md`), gets back four URLs (`index.html`, `style.css`, `script.js`, `preview.png`), and opens the in-panel **Share dialog** (per-row Copy, live 24h countdown, Copy AI prompt + 4 URLs, Revoke now). The clipboard "Copy AI prompt + 4 URLs" payload = the AI instruction block (§D) with all four URLs interpolated.

## B. Per-flow asset mapping

| Flow | HTML | CSS | JS | Image(s) |
|---|---|---|---|---|
| Full Page | inlined `index.html` | `style.css` | `script.js` | `screenshot.png` |
| Pick Element | `outerHTML` of selection | `matchedCss` (+ computed diff as comment block) | computed-diff JSON (informational) | context shot + isolated shot (when present) |

## C. UI placement

- Reuse `.lpe-debug-actions` pattern. Add a row above per-file Raw/Markdown buttons: `[ MD ] [ MD + files ] [ ZIP ] [ Share Links ]`.
- Share Links is **disabled** when not signed in to WordPress; tooltip points to Settings → Smart Share (WordPress).
- After a successful Smart Share upload the **Share dialog** owns the post-success UX (no toast); its countdown is driven by `expires_at` and ticks every second until "Expired".

## D. AI instruction block (canonical)

Lives in `extension-src/shared/copy.ts` as `AI_INSTRUCTION_BLOCK`:

```
I'm sharing a UI component with you. Please read all four files first,
then apply the change I describe at the end.

HTML:    {{HTML_REF}}
CSS:     {{CSS_REF}}
JS:      {{JS_REF}}
Image:   {{IMAGE_REF}}

Instructions:
1. Fetch and read the HTML to understand the current markup and structure.
2. Fetch and read the CSS to understand the current styling, tokens, and breakpoints.
3. Fetch and read the JS to understand any current behavior.
4. Open the image to see how the component currently renders.
5. Then make the change requested below — modify HTML/CSS/JS only. Do not break the existing structure, semantics, or responsiveness unless I ask for it. You may add animations, restyle, or adjust layout.

My request:
<write your change request here>
```

Refs per mode:
- MD (single): `(see §HTML below)` / `(see §CSS below)` / `(see §JS below)` / `(embedded inline)`
- MD + files: `./index.html` / `./style.css` / `./script.js` / `./images/screenshot.png`
- ZIP: same as MD + files
- Smart Share: the four returned URLs (`html`, `css`, `js`, `image`)

## E. Acceptance

1. Four mode buttons appear in both flows after success.
2. Single MD opens in any markdown viewer with images visible offline.
3. ZIP contains `prompt.md` at root.
4. Share Links is disabled until the user is signed in to WordPress in Settings → Smart Share.
5. After Smart Share success, the Share dialog opens with all four URLs and a working countdown; "Copy AI prompt + 4 URLs" produces the §D block with `{{HTML_REF}} / {{CSS_REF}} / {{JS_REF}} / {{IMAGE_REF}}` filled.
