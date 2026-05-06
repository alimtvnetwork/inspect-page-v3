# 19 — Edge cases (v1 behavior)

For each case: trigger, decision, code, user impact.

## E1. Cross-origin iframes
- Trigger: page contains `<iframe src="https://other.example/...">`.
- Decision: do NOT enter the iframe DOM. The serialized HTML keeps the `<iframe>` tag verbatim. Screenshot captures whatever the browser rendered (subject to X-Frame-Options).
- Code: none. Documented limitation in `00-overview.md` non-goals.

## E2. Same-origin iframes
- Trigger: `<iframe src="/relative">`.
- Decision: v1 treats iframes as opaque. CS does NOT walk into them. The iframe's pixels are still captured by `captureVisibleTab`.
- Code: `W_IFRAME_NOT_TRAVERSED` (warn once per export).

## E3. Shadow DOM (closed)
- Trigger: host page uses `attachShadow({ mode: 'closed' })`.
- Decision: cannot read; cloned `outerHTML` will lack shadow content. CSS rules inside the shadow are also invisible. Screenshot still correct.
- Code: `W_SHADOW_CLOSED` once per export.

## E4. Shadow DOM (open)
- Trigger: components with open shadow roots.
- Decision (v1): NOT walked in `outerHTML` (browser default), and matched-rules walker only traverses light DOM stylesheets. Documented limitation; v2 may expand.
- Code: `W_SHADOW_OPEN_SKIPPED` once per export when `document.querySelector('*')` reveals any element with `shadowRoot`.

## E5. CSP blocking inline `<style>` injection (panel mount)
- Trigger: host page sets `Content-Security-Policy` that disallows extension UA strings or inline styles.
- Decision: extension content scripts run in an isolated world; CSP applies to the host page, not to our injected scripts (Chrome MV3 documented behavior). However, dynamically created `<link>` to extension assets uses `chrome-extension://` URLs which are exempt.
- Code: if mount fails for any reason → `E_PANEL_MOUNT_FAILED`; popup remains usable.

## E6. CSP blocking image data URIs
- Trigger: page CSP blocks `data:` images. Does not affect extension UI inside Shadow DOM (host CSP does not apply to extension Shadow DOM contents).
- Decision: no action.

## E7. `data:` and `blob:` page URLs
- Trigger: tab URL is `data:` or `blob:`.
- Decision: full-page export disabled; popup shows `E_NOT_AVAILABLE_HERE`. Element export also disabled.

## E8. `chrome://`, `chrome-extension://`, `about:` pages
- Trigger: `tab.url` matches above.
- Decision: both buttons disabled; popup shows tooltip from copy `Not available on browser pages.`

## E9. SPA route change mid-export
- Trigger: `popstate`/`pushState` between collection and screenshot.
- Decision: CS records `location.href` at `CollectPageArtifacts` start. Before each `BeginScrollCapture` step, CS checks `location.href`. If changed → throw `E_ROUTE_CHANGED`, SW aborts and restores.
- Code: `E_ROUTE_CHANGED` (Error).

## E10. Infinite-scroll pages
- Trigger: page extends as user scrolls.
- Decision: we use `scrollHeight` snapshot taken once at the start. New content appended later is ignored. If `scrollHeight` grows during capture, we still cap at the snapshot value. Document: "Scroll once to fully expand the page before exporting."

## E11. Pages exceeding canvas limits
- See `20-performance-budgets.md`. Throw `E_PAGE_TOO_LARGE` with actionable message.

## E12. Custom fonts
- Trigger: `@font-face` with cross-origin URL.
- Decision: collected by CSS pipeline as text. Font binaries are NOT bundled in v1. The screenshot still shows correct fonts because Chrome already loaded them.
- Code: `W_FONT_NOT_BUNDLED` once per export when any `@font-face` is encountered.

## E13. Web components / custom elements
- Trigger: `customElements.get(...)` defined.
- Decision: `outerHTML` includes the tag; behavior absent. Document only.
- Code: `W_WEB_COMPONENT_SKIPPED` once per export.

## E14. Print stylesheets
- Trigger: `<link media="print">`.
- Decision: still included in `styles.css` with media markers preserved. We do NOT switch the browser to print mode.

## E15. Sites that hijack `contextmenu`
- Trigger: page calls `e.preventDefault()` on `contextmenu` in capture phase.
- Decision: picker registers in capture phase first and calls `stopPropagation`, so we win. If the host page registered with `addEventListener('contextmenu', ..., true)` first on `window`, both run; ours still triggers selection because we do not `return false` early.

## E16. Heavy `mousemove` host listeners
- Trigger: hover throttled by host script.
- Decision: picker uses passive RAF coalescing on `mousemove`; if host blocks the main thread, overlay updates lag. Acceptable.

## E17. Pages that `display: none` `<html>` or `<body>`
- Trigger: pre-render shells.
- Decision: snapshot still serializable. Screenshot will be a blank canvas. We capture as-is and add `W_BLANK_PAGE_SUSPECTED` if `pageCssPx.h < viewportCssPx.h * 0.1`.

## E18. Multiple monitors / HiDPI
- Trigger: `devicePixelRatio` ≠ 1.
- Decision: canvas dimensions multiplied by DPR. Captured frames already arrive at device resolution; do not scale source.

## E19. JPEG quality on PNG selection
- Trigger: settings has `imageFormat='png'` but `jpegQuality` set.
- Decision: ignore `jpegQuality`. UI grays out the slider.

## E20. Browser process killed (SW eviction) mid-export
- Trigger: long pages may exceed SW idle limit.
- Decision: SW uses `chrome.alarms` keep-alive ping (`KEEPALIVE_INTERVAL_MS = 25000`) during active exports. On unexpected wake-up, SW finds no in-memory state and sends `E_EXPORT_INTERRUPTED` to any open panel/popup that resubscribes.

## Reserved warnings list (single-fire per export)
`W_IFRAME_NOT_TRAVERSED, W_SHADOW_CLOSED, W_SHADOW_OPEN_SKIPPED, W_FONT_NOT_BUNDLED, W_WEB_COMPONENT_SKIPPED, W_BLANK_PAGE_SUSPECTED, W_ANIMATED_CONTENT, W_STICKY_SCAN_TRUNCATED`. The SW deduplicates by `(requestId, code)`.
