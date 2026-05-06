# 03 — Full Page Export

## Output
Single ZIP: `llm-export-fullpage-{domain}-{timestamp}.zip`

```
page.html         Serialized DOM at export time
styles.css        All CSS merged in source order
scripts.js        All JS merged in source order
screenshot.png    Full-page scroll-and-stitch capture
manifest.json     Export metadata (url, title, ts, viewport, ua, counts)
```

## Pipeline (content script)
1. Snapshot DOM via `document.documentElement.outerHTML`. Inline computed `<base href>` so relative URLs resolve.
2. Collect CSS:
   - Inline `<style>` blocks → append text.
   - `<link rel="stylesheet">` → try `sheet.cssRules`; on `SecurityError` fall back to `fetch(href)`.
   - On CORS failure, append `/* unreachable: <url> */` so the LLM still sees the reference.
   - Concatenate in document source order, separated by `/* === <source> === */` headers.
3. Collect JS:
   - Inline `<script>` (no `src`) → append text.
   - `<script src>` → `fetch(src)`; on failure append `/* unreachable: <url> */`.
   - Skip scripts with `type="application/json"` or `type="importmap"` (preserved in HTML).
4. Trigger screenshot pipeline (`06-screenshot-strategy.md`).
5. Send all four artifacts + metadata to the service worker for ZIP assembly.

## Pipeline (service worker)
- Build ZIP with JSZip, `compression: "DEFLATE"`, level 6.
- Trigger `chrome.downloads.download` with the ZIP blob URL.

## Acceptance check
HTML opens standalone in a browser. CSS file parses without syntax errors. JS file parses (syntax-only, runtime errors allowed). PNG width = page scrollWidth × DPR, height = page scrollHeight × DPR.
