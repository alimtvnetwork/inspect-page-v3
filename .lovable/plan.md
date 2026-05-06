# Plan — LLM Page Export Chrome Extension

## Phase 0 — Spec writing (this is what runs first when you say "next")

Before any code, I will create the `spec/21-app/` folder with the documents below. Nothing else is built in Phase 0.

```text
spec/
└── 21-app/
    ├── 00-overview.md            Verbatim brief + goals + non-goals
    ├── 01-architecture.md        MV3 layout: popup, content script, service worker, offscreen doc
    ├── 02-ui-panel.md            Toolbar popup + injected floating panel (both)
    ├── 03-full-page-export.md    HTML / CSS / JS / screenshot pipeline + ZIP bundling
    ├── 04-element-picker.md      Hover outline, tooltip, right-click export, Esc to cancel
    ├── 05-element-export.md      Computed + matched CSS + outerHTML + 2 screenshots, .md output
    ├── 06-screenshot-strategy.md Scroll-and-stitch algorithm, sticky-element handling, DPR
    ├── 07-file-naming.md         Timestamp + sanitized domain + page title pattern
    ├── 08-permissions.md         activeTab, scripting, downloads, storage, tabs, host_permissions
    ├── 09-error-handling.md      Logging, user-surfaced errors, never-swallow rule
    ├── 10-coding-guidelines.md   Local mirror of .lovable/coding-guidelines.md rules to enforce
    ├── 11-acceptance-criteria.md Test checklist mapped to your AC list
    ├── 12-build-and-package.md   Vite build, manifest, zip via nix, /public delivery
    └── diagrams/
        ├── architecture.mmd      Mermaid component diagram
        └── flows.mmd             Mermaid sequence diagrams (full page + element)
└── plan.md                       High-level phase plan (mirrors this document)
```

## Locked decisions (from your answers)

- **UI**: Toolbar popup AND injected floating panel. Popup has the same two buttons and can also "Open panel on page".
- **Full Page bundle**: Single `.zip` via JSZip → `llm-export-fullpage-{domain}-{timestamp}.zip` containing `page.html`, `styles.css`, `scripts.js`, `screenshot.png`, `manifest.json` (export metadata).
- **Element CSS**: Computed styles + matched rules + `outerHTML` in the `.md`.
- **Full-page screenshot**: Scroll-and-stitch using `chrome.tabs.captureVisibleTab` — no `debugger` permission needed.

## Phase plan (you drive with "next")

1. **Phase 0 — Spec** Write all files under `spec/21-app/` and `plan.md`. No code.
2. **Phase 1 — Skeleton** Vite + TS project, `extension/manifest.json`, popup shell, service worker, content script registration, icon, build → `public/llm-export.zip` via nix.
3. **Phase 2 — Floating panel + popup UI** Inject panel, two buttons, status indicator, close/minimize, Esc handling. Popup mirrors actions.
4. **Phase 3 — Full Page export** HTML serialization, CSS collection (linked + inline + cross-origin fallback), JS collection, ZIP assembly, download.
5. **Phase 4 — Scroll-and-stitch screenshot** Disable sticky/fixed elements during capture, scroll step = viewport height, stitch on `<canvas>` in offscreen document, append PNG to ZIP.
6. **Phase 5 — Element picker** Overlay outline, tag/id/class tooltip, right-click → export, Esc cancels.
7. **Phase 6 — Element export** Computed styles, matched CSSOM rules, `outerHTML`, two screenshots (in-context crop + isolated render), Base64 embed in `.md`, download.
8. **Phase 7 — Polish** Errors surfaced in panel, settings (image format/quality), file-naming pattern, smoke test against 3 sites, package final ZIP into `public/`.

If a phase becomes too large mid-implementation, I will list the remaining sub-tasks so the next "next" continues them.

## Technical notes (for the engineer, not required reading for you)

- **Stack**: Vite + TypeScript + React for popup/panel UI, Tailwind for styles, JSZip for bundling, MV3 service worker, content script + offscreen document for canvas stitching.
- **Permissions**: `activeTab`, `scripting`, `downloads`, `storage`, `tabs`, `<all_urls>` host permission, `offscreen`. No `debugger`.
- **Cross-origin CSS**: `CSSStyleSheet.cssRules` throws for cross-origin sheets — fallback is `fetch(href)` then inline; if CORS blocks, record a `/* unreachable: <url> */` comment so the LLM still sees the reference.
- **Matched rules without CDP**: Walk `document.styleSheets`, for each rule test `element.matches(rule.selectorText)`, collect in source order with specificity.
- **Isolated element screenshot**: Clone node into an offscreen iframe with collected CSS, render via `html2canvas` (or DOM-to-image) — decision finalized in `05-element-export.md`.
- **Coding guidelines**: Functions ≤ 8 lines, no nested ifs, positive conditions only, `is`/`has` boolean prefixes, no `any`/`unknown`, enums/constants for all strings/numbers, files ≤ 100 lines, never swallow errors. Spec file `10-coding-guidelines.md` will mirror `.lovable/coding-guidelines.md` so it's enforceable per phase.

```text
Do you understand?
```

Say **next** to start Phase 0 (write the spec).
