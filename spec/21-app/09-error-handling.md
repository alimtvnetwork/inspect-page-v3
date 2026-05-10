# 09 — Error handling and error catalog

## Rules (binding)
- Every `catch` MUST call `logger.error(category, code, message, error?)`. Errors are NEVER swallowed.
- Recoverable issues use `logger.warn` and a `W_*` code; unrecoverable use `logger.error` and an `E_*` code.
- User-facing errors set `PanelStatus.Error` and surface `{message} ({code})` plus a "Copy details" button.
- `Copy details` copies a JSON blob: `{ code, message, kind, requestId, capturedAtIso, extensionVersion, userAgent }`. NEVER include page contents, URLs of other tabs, or secrets.

## Categories (`enum LogCategory`)
`Capture | CssCollect | JsCollect | HtmlSerialize | Picker | Element | Stitch | Zip | Download | Messaging | Offscreen | Storage | Settings | Lifecycle`

## Severity
`Debug | Info | Warn | Error`. Default surface threshold: `Warn` in DevTools, `Error` in panel.

## Code naming
- `E_*` — fatal for the current operation.
- `W_*` — degrades gracefully; export still completes.

## Catalog

| Code | Category | Severity | Message (English) | User message | Recovery |
|---|---|---|---|---|---|
| `E_HTML_SERIALIZE` | HtmlSerialize | Error | Failed to serialize document. | Could not read this page. | Abort export. |
| `W_CSS_FETCH_FAILED` | CssCollect | Warn | Could not fetch stylesheet `{url}`. | — | Insert `/* unreachable: {url} */`, continue. |
| `W_CSS_INLINE_UNREADABLE` | CssCollect | Warn | Inline cross-origin sheet not readable. | — | Skip rules, continue. |
| `W_CSS_PARSE_FAILED` | CssCollect | Warn | Failed to parse stylesheet `{url}`. | — | Skip sheet. |
| `W_JS_FETCH_FAILED` | JsCollect | Warn | Could not fetch script `{url}`. | — | Insert `/* unreachable */`, continue. |
| `E_PAGE_TOO_LARGE` | Capture | Error | Page exceeds canvas limit ({w}×{h}px). | Page is too large to capture. Try Element export. | Abort. |
| `E_CAPTURE_FAILED` | Capture | Error | `captureVisibleTab` failed after retry. | Could not capture screenshot. | Abort, restore page state. |
| `E_SCROLL_TIMEOUT` | Capture | Error | Scroll step did not settle in time. | Page is unresponsive. | Abort. |
| `E_STITCH_FAILED` | Stitch | Error | Offscreen canvas blit failed. | Could not stitch screenshot. | Abort. |
| `W_STICKY_SCAN_TRUNCATED` | Capture | Warn | Sticky scan truncated at limit. | — | Continue (possible ghosting). |
| `W_ANIMATED_CONTENT` | Capture | Warn | Animated content detected; seams possible. | — | Continue. |
| `E_OFFSCREEN_BUSY` | Offscreen | Error | Offscreen document busy. | Try again. | Abort, retry button shown. |
| `E_ISOLATED_TIMEOUT` | Element | Error | Isolated render timed out. | — | Continue without isolated image. |
| `E_ISOLATED_FAILED` | Element | Error | Isolated render failed. | — | Continue without isolated image. |
| `E_ELEMENT_ZERO_SIZE` | Element | Error | Selected element has zero size. | Selected element is not visible. | Abort element export. |
| `W_SELECTOR_INVALID` | Element | Warn | Selector `{sel}` not parseable. | — | Skip rule. |
| `W_AT_RULE_SKIPPED` | Element | Warn | At-rule `{name}` skipped (v1). | — | Continue. |
| `W_MD_TRUNCATED` | Element | Warn | Markdown truncated to fit budget. | Output truncated to fit size limit. | Apply degradation order from `05`. |
| `E_ZIP_FAILED` | Zip | Error | JSZip generateAsync failed. | Could not build the bundle. | Abort. |
| `E_DOWNLOAD_FAILED` | Download | Error | `chrome.downloads.download` failed. | Download failed. | Show Retry button (re-uses blob URL). |
| `E_COLLECT_TIMEOUT` | Messaging | Error | Content script did not respond in time. | Page did not respond. | Abort. |
| `E_EXPORT_TIMEOUT` | Messaging | Error | Export exceeded overall timeout. | Export took too long. | Abort. |
| `E_STORAGE_PARSE` | Storage | Error | Stored settings unreadable. | Settings reset to defaults. | Overwrite with defaults. |
| `E_NOT_AVAILABLE_HERE` | Lifecycle | Error | Page type not supported. | Not available on browser pages. | Disable buttons. |
| `E_PERMISSION_DENIED` | Lifecycle | Error | Required permission missing. | Re-install the extension. | Abort, link to install steps. |
| `E_SHARE_BAD_INPUT` | Messaging | Error | Share Links called without WP credentials or assets. | Configure WordPress in Settings before sharing. | Abort, open Settings. |
| `E_SHARE_AUTH` | Messaging | Error | WordPress rejected credentials (HTTP 401/403). | WordPress login failed — check the Application Password. | Abort, open Settings. |
| `E_SHARE_NETWORK` | Messaging | Error | Network failure reaching WordPress site. | Could not reach your WordPress site. | Abort, Retry button shown. |
| `E_SHARE_UPSTREAM` | Messaging | Error | WordPress returned non-2xx (`{status}`). | Your WordPress site rejected the upload ({status}). | Abort, surface server message. |
| `W_FONT_UNREACHABLE` | CssCollect | Warn | `@font-face` URL `{url}` could not be fetched. | — | Skip inlining; screenshot still uses page-loaded font. |
| `W_WEB_COMPONENT_SKIPPED` | HtmlSerialize | Warn | Page declares custom elements; behavior not bundled. | — | Preserve `outerHTML`, continue. |
| `E_IFRAME_CROSS_ORIGIN` | HtmlSerialize | Warn | Cross-origin iframe could not be inlined; original `src` kept. | — | Continue; offline export will not render iframe contents. |

## Logging surface
- SW logs visible in `chrome://extensions` → service worker DevTools.
- CS / panel logs in host page DevTools, prefixed `[pageport]`.
- Offscreen logs in offscreen DevTools, prefixed `[pageport:offscreen]`.

## Never-swallow examples
```text
WRONG  try { ... } catch { /* ignore */ }
WRONG  try { ... } catch (e) { return null }
RIGHT  try { ... } catch (e) { logger.warn(LogCategory.CssCollect, 'W_CSS_FETCH_FAILED', url, e); return ''; }
RIGHT  try { ... } catch (e) { logger.error(LogCategory.Stitch, 'E_STITCH_FAILED', '', e); throw makeWireError('E_STITCH_FAILED', 'Could not stitch screenshot.'); }
```

## Reserved future codes
_(none — all edge-case codes from `19-edge-cases.md` are now wired in source.)_
