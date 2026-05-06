# 03 — Full Page export

## Output
Single ZIP. Layout and `manifest.json` schema in `17-file-formats.md`. Filename in `07-file-naming.md`.

## Pipeline (high level)

```
Popup/Panel ─RunFullPageExport→ SW
SW ─CollectPageArtifacts→ CS  ──{html,css,js,meta}──▶ SW
SW ─BeginScrollCapture→ CS    (per step y)
SW ─CaptureViewport (internal) → dataUrl
SW ─OffscreenAddFrame→ Offscreen (per frame)
SW ─OffscreenStitchFinish→ Offscreen ─blobUrl→ SW
SW ─RestoreAfterCapture→ CS
SW assembles ZIP via JSZip ─chrome.downloads.download→ file
SW ─StatusUpdate(success|error)→ Popup/Panel
```

## P1. Collect HTML (CS)

Inputs: none. Outputs: `string html`. Invariant: DOM not mutated permanently.

1. Snapshot `serializedDoctype = document.doctype ? new XMLSerializer().serializeToString(document.doctype) : '<!DOCTYPE html>'`.
2. Clone `document.documentElement` deeply via `cloneNode(true)`.
3. In the clone: ensure `<head>` exists; insert `<base href="{location.href}">` as first child if not present.
4. In the clone: ensure `<meta charset="utf-8">` is present.
5. If `settings.redactPasswordFields`: for every `input[type=password]` set `value=""` and add `data-redacted="true"`.
6. Serialize: `html = serializedDoctype + '\n' + clone.outerHTML + '\n'`.

On failure: throw `E_HTML_SERIALIZE`.

## P2. Collect CSS (CS)

Inputs: none. Output: `string css`, `cssCounts`.

1. Init `chunks: string[] = []`, counters `inline=0, linked=0, unreachable=0`.
2. For each `sheet` in `document.styleSheets` in source order:
   a. `header = sheet.href ?? "inline #" + (++inline)`
   b. Try `text = [...sheet.cssRules].map(r => r.cssText).join('\n')`.
   c. On `SecurityError` (cross-origin): if `sheet.href` → `text = await fetchText(sheet.href)` else throw `E_CSS_INLINE_UNREADABLE`.
   d. On fetch failure → `text = ''; unreachable++; header = "unreachable: " + sheet.href`.
   e. `chunks.push("/* === <" + header + "> === */\n" + text)`.
   f. If `sheet.href` and read succeeded → `linked++`.
3. `css = chunks.join('\n\n') + '\n'`.

On failure of step 2.c with no `href`: log `W_CSS_INLINE_UNREADABLE` and continue.

## P3. Collect JS (CS)

Inputs: none. Output: `string js`, `jsCounts`.

1. For each `script` in `document.querySelectorAll('script')` in document order:
   a. Skip if `type` ∈ `{ 'application/json', 'application/ld+json', 'importmap' }`.
   b. Skip if `script.noModule === true && document.currentScript supports module` (rare; document and skip).
   c. If no `src` → `text = script.textContent ?? ''; header = "inline #" + (++inline)`.
   d. Else → `text = await fetchText(script.src)`; on failure `text=''; unreachable++; header="unreachable: "+src`; on success `linked++; header=src`.
   e. Push `"/* === <" + header + "> === */\n" + text`.
2. Join with `'\n\n'` and trailing `\n`.

JS is **not executed** during collection; we only ship its source. Syntax errors are tolerated.

## P4. Build ExportMeta (CS)

Fields per `17-file-formats.md`. Source values:
- `viewportCssPx = { w: innerWidth, h: innerHeight }`
- `pageCssPx     = { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }`
- `devicePixelRatio = window.devicePixelRatio`
- `userAgent = navigator.userAgent`
- `extensionVersion = chrome.runtime.getManifest().version`

## P5. Screenshot (SW + CS + Offscreen)
See `06-screenshot-strategy.md`. Returns `screenshot.png` blob.

## P6. Assemble ZIP (SW)

1. `zip = new JSZip()`.
2. `zip.file('page.html', html)`.
3. `zip.file('styles.css', css)`.
4. `zip.file('scripts.js', js)`.
5. `zip.file('screenshot.png', pngBlob)`.
6. `zip.file('manifest.json', JSON.stringify(meta, null, 2) + '\n')`.
7. `zip.file('README.txt', README_TXT)` (constant from `17-file-formats.md`).
8. `blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', compressionOptions:{ level: 6 } })`.
9. `url = URL.createObjectURL(blob)`.
10. `downloadId = await chrome.downloads.download({ url, filename, saveAs: false })`.
11. Revoke `url` on `chrome.downloads.onChanged` `state==='complete'`.

## P7. Cleanup
- Restore sticky/fixed elements (handled by `RestoreAfterCapture`, see `06`).
- Restore scroll position to original.
- Send `StatusUpdate { status: Success, message: filename }`.

## Error table

| Step | Code | Recovery |
|---|---|---|
| P1 | `E_HTML_SERIALIZE` | Abort export. |
| P2 fetch | `W_CSS_FETCH_FAILED` | Continue with `unreachable:` marker. |
| P2 inline cross-origin no href | `W_CSS_INLINE_UNREADABLE` | Continue. |
| P3 fetch | `W_JS_FETCH_FAILED` | Continue with `unreachable:` marker. |
| P5 | `E_CAPTURE_FAILED` / `E_STITCH_FAILED` | Abort export, restore page. |
| P6 | `E_ZIP_FAILED` | Abort, surface error. |
| P6 | `E_DOWNLOAD_FAILED` | Surface error; keep blob URL for retry button. |
