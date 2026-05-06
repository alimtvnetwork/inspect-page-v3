# 21 — Security and privacy

## Stance
- The extension is **fully local**. No telemetry, no analytics, no remote configuration.
- The only network traffic the extension itself initiates is `fetch()` against URLs already referenced by the host page (stylesheets, scripts) — same things the browser would load anyway.
- No third-party SDKs.

## Data handling rules

| Data | Lives where | Lifetime | Egress |
|---|---|---|---|
| Settings | `chrome.storage.local` | Until uninstall or user reset. | None. |
| Panel position | `chrome.storage.local` | Same. | None. |
| Last export record | `chrome.storage.local` | Overwritten per export. | None. |
| Page HTML/CSS/JS | In-memory during export. | Released after ZIP download or on error. | Saved to user's Downloads folder ONLY. |
| Screenshots | In-memory `OffscreenCanvas` during export. | Released after blob URL revoked. | Saved to Downloads ONLY. |
| Logs | DevTools console only. | Per-context. | None. |

## Password & secret redaction

- `settings.redactPasswordFields` (default `true`):
  - In `page.html`: every `<input type="password">` is serialized with empty `value` and `data-redacted="true"`.
  - In element export `outerHtml`: same rule applied to descendants.
- We do NOT attempt to redact other "secret-looking" fields (autofill credit cards, OTPs). Out of scope; document this in the panel settings tooltip: "Redacts only `<input type=password>`. Review your export before sharing."

## Permissions justification (mirror of `08-permissions.md`)

| Permission | Why |
|---|---|
| `activeTab` | Run on the tab the user explicitly invokes the extension in. |
| `scripting` | Programmatic injection of content script + panel. |
| `tabs` | `captureVisibleTab` requires it. |
| `downloads` | Save the ZIP / MD outputs locally. |
| `storage` | Persist settings + panel position. |
| `offscreen` | Own a DOM context for canvas stitching (SW has no DOM). |
| `<all_urls>` (host) | Content script must run on any site the user opens it on. |

## Explicitly NOT requested
- `debugger` — would show a yellow warning bar; avoided by using scroll-and-stitch.
- `webRequest`, `webRequestBlocking` — not needed; we never inspect or modify network traffic.
- `cookies` — never read.
- `history`, `bookmarks`, `topSites` — never read.

## Threat model (brief)

| Threat | Mitigation |
|---|---|
| Malicious page tries to invoke our internal listeners | All listeners check `chrome.runtime.id`-bound message envelope; cross-context `MessageKind` is enum-validated. |
| Malicious page injects fake panel | Our panel lives in a Shadow DOM whose host has a unique attribute; popup does not trust DOM presence — it queries SW. |
| Page tries to read our storage | `chrome.storage` is extension-scoped; pages cannot access it. |
| User exports a page with secrets | `redactPasswordFields` on by default; settings tooltip warns user to review before sharing. |
| Page CSP affects extension UI | Extension UI is in Shadow DOM + content-script isolated world; host CSP does not apply. |
| Extension keeps blob URLs alive | Every `URL.createObjectURL` is paired with `URL.revokeObjectURL` in `finally` or after `chrome.downloads.onChanged complete`. |

## Update / version
- Extension version comes from `manifest.json`. Bumped per release per semver.
- No silent auto-update mechanism beyond Chrome's standard handling for unpacked extensions (none — user reloads).

## Logs hygiene
- Logs MUST NOT contain page contents, full URLs of other tabs, cookies, or storage values.
- `Copy details` payload is whitelisted: `{ code, message, kind, requestId, capturedAtIso, extensionVersion, userAgent }`.
