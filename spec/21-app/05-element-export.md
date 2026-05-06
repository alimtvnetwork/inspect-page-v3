# 05 — Element export

Triggered by `04-element-picker.md` selection. Produces one `.md` file (format in `17-file-formats.md`).

## Pipeline

```
CS picker → CS.exportElement(target)
  ├─ build payload (P1..P5)
  ├─ send RunElementExport → SW
  └─ SW renders isolated → SW writes md → SW downloads
```

## P1. Compute selector path (CS)

Walk from `target` up to `<html>`. For each ancestor `el`:
- If `el.id` and id is unique in document → emit `tag#id` and stop.
- Else if siblings of same tag exist → emit `tag:nth-of-type(N)`.
- Else emit `tag`.
Join with ` > `. Cap depth at `SELECTOR_MAX_DEPTH = 12`; if exceeded, prepend `… > `.

## P2. outerHTML (CS)
- `outerHtml = target.outerHTML`.
- If `settings.redactPasswordFields` → replace any `value="..."` on `input[type=password]` descendants with `value=""`.

## P3. Matched-rule walker (CS)

Inputs: `target`. Output: `string matchedCss`.

1. `out: string[] = []`.
2. For each `sheet` in `document.styleSheets` in source order:
   a. `header = sheet.href ?? "inline #" + sheetIndex`.
   b. Try iterate `sheet.cssRules`.
   c. On `SecurityError` and `sheet.href`: `text = await fetchText(href); parsed = await parseSheet(text)`; iterate `parsed.cssRules`. Use a hidden `<style>` injected into a same-document detached `Document` via `document.implementation.createHTMLDocument()` to safely parse.
3. For each rule:
   - If `rule instanceof CSSStyleRule`:
     a. Try `if (target.matches(rule.selectorText))` → `out.push("/* from: <"+header+"> */\n"+rule.cssText)`.
     b. `SyntaxError` (invalid selector for this engine): skip + log `W_SELECTOR_INVALID`.
   - If `rule instanceof CSSMediaRule` and `matchMedia(rule.conditionText).matches`: recurse into `rule.cssRules` with the same logic.
   - Else: ignore in v1 (`@supports`, `@layer`, `@container` DEFERRED to v2 — record once as `W_AT_RULE_SKIPPED`).
4. `matchedCss = out.join('\n\n')`.

## P4. Computed-style diff (CS)

1. Create hidden iframe via offscreen-only DOM: `iframe = document.createElement('iframe'); iframe.style.cssText='position:absolute;left:-99999px;width:0;height:0;border:0'; document.body.appendChild(iframe)`.
2. In `iframe.contentDocument` create `<{tag}></{tag}>` of the same tag as target, append to body.
3. `defaults = getComputedStyle(iframeEl)`.
4. `actual = getComputedStyle(target)`.
5. For each property index `i` in `actual`:
   - `name = actual[i]; av = actual.getPropertyValue(name); dv = defaults.getPropertyValue(name)`.
   - If `av !== dv` → `diff[name] = av`.
6. Remove iframe.
7. Serialize: lines `"{name}: {value};"` joined by `\n`.

If `settings.includeComputedStyles === false` → return `''`.

## P5. In-context screenshot (SW)

1. Save `prevScroll`. Scroll element into view: `target.scrollIntoView({ block:'center', inline:'center', behavior:'auto' })`.
2. Await 2 RAFs + `FRAME_SETTLE_MS`.
3. `rect = target.getBoundingClientRect()`.
4. SW: `dataUrl = await captureVisibleTab(...)`.
5. Offscreen: crop:
   - `img = await createImageBitmap(...)`.
   - `c = new OffscreenCanvas(rect.width*dpr, rect.height*dpr)`.
   - `ctx.drawImage(img, rect.x*dpr, rect.y*dpr, rect.width*dpr, rect.height*dpr, 0, 0, rect.width*dpr, rect.height*dpr)`.
   - `blob = await c.convertToBlob({ type:'image/png' })`.
6. Restore `prevScroll`.

If `rect.width === 0 || rect.height === 0` → `E_ELEMENT_ZERO_SIZE`, abort.

## P6. Isolated render (Offscreen)

CS builds `isolatedHtml`:
1. `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="{location.href}"><style>{matchedCss}</style></head><body style="margin:0;background:transparent">{outerHtml}</body></html>`.
2. CS sends `{ html: isolatedHtml, widthPx: rect.width, heightPx: rect.height }` to SW → Offscreen.
3. Offscreen `OffscreenRenderIsolated`:
   a. Create same-origin `iframe` inside offscreen document, set `srcdoc=html`, dimensions `widthPx × heightPx`.
   b. Wait `iframe.onload`.
   c. Use `html-to-image` `toPng(iframe.contentDocument.body, { pixelRatio: dpr, cacheBust: false })`.
   d. Return `dataUrl`.

If `iframe.onload` not fired in `ISOLATED_LOAD_TIMEOUT_MS = 5000` → `E_ISOLATED_TIMEOUT`.

## P7. Assemble Markdown (SW)

Apply template from `17-file-formats.md`. Order of degradation if `MD_FILE_MAX_BYTES` exceeded:
1. Drop isolated screenshot, append `> Truncated: isolated screenshot exceeded budget`.
2. Drop computed styles section.
3. Downscale context screenshot to fit, with note.

## P8. Download
`chrome.downloads.download({ url: blobUrl, filename, saveAs: false })`. Revoke URL on completion.

## Error table

| Step | Code | Recovery |
|---|---|---|
| P3 cross-origin parse | `W_CSS_PARSE_FAILED` | Skip sheet, continue. |
| P3 selector invalid | `W_SELECTOR_INVALID` | Skip rule. |
| P5 rect zero | `E_ELEMENT_ZERO_SIZE` | Abort. |
| P5 capture | `E_CAPTURE_FAILED` | Abort. |
| P6 timeout | `E_ISOLATED_TIMEOUT` | Continue without isolated img; mark truncated. |
| P6 render | `E_ISOLATED_FAILED` | Same. |
| P7 over budget | `W_MD_TRUNCATED` | Apply degradation order. |
