# 13 — Decision log

Every entry is `LOCKED` unless marked otherwise. Do not reopen.

| # | Decision | Chosen | Rejected | Reason |
|---|---|---|---|---|
| D1 | Manifest version | MV3 | MV2 | MV2 is deprecated by Chrome. |
| D2 | UI surfaces | Toolbar popup AND injected floating panel | Popup only / panel only | User asked for both. |
| D3 | Full-page bundle format | Single `.zip` | 4 separate files / folder | User selected zip. |
| D4 | Zip library | JSZip 3.x | fflate, zip.js | Mature, smallest API, browser-friendly. |
| D5 | Element CSS payload | Computed + matched + outerHTML | One of the three | User selected all three. |
| D6 | Full-page screenshot method | Scroll-and-stitch via `chrome.tabs.captureVisibleTab` | CDP `Page.captureScreenshot` | Avoids `debugger` permission and the in-tab warning bar. |
| D7 | Isolated element render lib | `html-to-image` 1.x | `html2canvas`, `dom-to-image-more` | Best CSS coverage / size ratio for our budget. |
| D8 | UI framework | React 18 + TypeScript | Preact, Solid, vanilla | Matches Lovable host project conventions. |
| D9 | Styling | Tailwind CSS 3 inside Shadow DOM | Inline styles, CSS Modules | Reuses host design tokens; Shadow DOM prevents bleed. |
| D10 | Build tool | Vite 5 with `vite-plugin-web-extension` | webpack, esbuild bare | Fast HMR; first-class MV3 support. |
| D11 | State persistence | `chrome.storage.local` | `localStorage`, IndexedDB | Required: SW has no `localStorage`; settings are tiny. |
| D12 | Cross-origin CSS strategy | Try `cssRules`, fallback `fetch`, then `/* unreachable */` | Skip silently | Keeps LLM aware of missing context. |
| D13 | Element selection trigger | Right-click on highlighted element | Left-click | Avoids firing host page click handlers. |
| D14 | Picker cancel | `Escape` and panel "Cancel" button | Click outside | Predictable; click-outside conflicts with host UIs. |
| D15 | Iframes (v1) | Top frame only | All same-origin frames | Scope control; deferred to v2. |
| D16 | Image format default | PNG | JPEG | Lossless; user can switch in settings. |
| D17 | Throttle for `captureVisibleTab` | One capture per `CAPTURE_GAP_MS` | No throttle | Chrome rate-limits to ~2/sec. |
| D18 | Sticky/fixed handling during stitch | Hide via `visibility: hidden`, restore after | Leave visible | Prevents ghosting across frames. |
| D19 | Privacy | No network egress beyond fetching same-page assets | Telemetry | User asked for an in-browser tool. |
| D20 | Distribution | Lovable landing page hosts `public/llm-export.zip` for "Load unpacked" | Chrome Web Store | v1 only; CWS submission deferred. |

## DEFERRED to v2
- Cross-origin iframe capture.
- Auto-publish to Chrome Web Store.
- Cloud sync of settings.
- Headless / programmatic API.
