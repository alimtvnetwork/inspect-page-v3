# Changelog

All notable changes to **LLM Page Export** are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-05-06

### Added — v2 fidelity pass (`spec/19-edge-cases.md`)

- **Open shadow DOM walker** — full-page and element exports now recurse
  into every `Element.shadowRoot` whose mode is `"open"` and inline its
  children as a [Declarative Shadow DOM](https://developer.chrome.com/articles/declarative-shadow-dom/)
  `<template shadowrootmode="open">` block. Web-component-driven sites
  (Lit, FAST, Spectrum, Ionic, YouTube player chrome, GitHub
  primer-elements, …) now round-trip with their visible markup intact.
  Closed shadow roots are deliberately *not* expanded — the platform's
  privacy boundary is preserved.
- **Constructed stylesheets capture** — `adoptedStyleSheets` attached to
  any open shadow root or to `document` are serialized via `cssRules`
  and inlined as `<style data-adopted-stylesheet="true">` tags so that
  CSS authored via `new CSSStyleSheet()` (the Lit/FAST default) survives
  the export.
- **Font binary bundling** — every `@font-face { … src: url(…) … }`
  reference in the collected CSS is fetched (`credentials: "omit"`),
  base64-encoded, and rewritten to a `data:` URI. Per-font cap defaults
  to 1 MiB; total budget defaults to 5 MiB; identical URLs are
  deduplicated. Exports now render with original typography fully
  offline.
- **Cross-origin iframe traversal** — same-origin `<iframe>`s have their
  `contentDocument` recursively serialized (HTML + CSS + adopted sheets +
  font bundling) and inlined as `srcdoc="…"` plus a
  `data-llm-export-srcdoc="true"` marker. Cross-origin frames are left
  with their original `src` and tagged
  `data-llm-export-cross-origin="true"` so consumers can see what was
  unreachable. Recursion depth is capped at 3.
- **Export metadata expansion** — `ExportMeta.counts` now reports
  `fontsInlined`, `fontsBytesInlined`, `fontsFailed`, `iframesTotal`,
  `iframesSameOrigin`, `iframesCrossOrigin`, and `iframesFailed`.
- **In-panel telemetry surface** — successful Full Page exports now
  render a "Captured in this export" block in the floating panel,
  showing shadow roots expanded, fonts inlined (with compact byte
  size), same/cross-origin iframes, stylesheets, and capture frames.
  Zero-valued counters are omitted so minimal pages produce a minimal
  block. Adds `shadowRootsExpanded` to `ExportMeta.counts`.
- **Element-export telemetry parity** — successful element exports now
  surface the same "Captured in this export" block via a `Success`
  `StatusUpdate` broadcast carrying telemetry (the element flow has no
  top-level response). Reports `outerHTML` bytes, matched-CSS rule
  count, computed-style diff entry count, and combined context +
  isolated screenshot bytes. When the offscreen isolated render fails,
  the row reads `X KB + isolated skipped`. Adds optional
  `elementOuterHtmlBytes`, `elementMatchedRules`,
  `elementComputedDiffEntries`, `elementContextPngBytes`,
  `elementIsolatedPngBytes`, `elementIsolatedSkipped` to
  `ExportMeta.counts`, and an optional `telemetry` field to
  `StatusUpdatePayload`.

### Added — Tooling

- **CI** — `.github/workflows/extension-ci.yml` runs lint, tests, build,
  and packaging on every push / PR touching `extension*/`. Enforces the
  1.5 MiB package budget (AC-BD-2) and uploads the resulting zip +
  checksum as a 30-day artifact.
- **Chrome Web Store assets** — `store-assets/` now contains the listing
  copy (`LISTING.md`), 5 × 1280×800 screenshots, a 440×280 small promo
  tile, and a 1400×560 marquee tile, all sized to spec.
- **QA checklist (v1.1)** — `docs/QA-CHECKLIST.md` gains §7 (T19–T22)
  covering the four v2 features, the full-page panel telemetry, and the
  element-export telemetry parity, with 27 new acceptance items
  (AC-FD-1 … AC-FD-27) and a printable PDF mirror at
  `/mnt/documents/llm-export-qa-checklist.pdf`.

### Changed

- `collectHtml` no longer mutates a cloned `<html>` to inject `<base>`
  and `<meta charset>`; it patches the serialized string in place.
- `extension/vitest.config.ts` adds `environmentMatchGlobs` so DOM-touching
  tests under `capture/**` and `element/**` run in `happy-dom`, while
  pure-logic tests stay in the faster `node` env. `server.fs.allow` is
  widened to permit reading test files from `../extension-src`.

### Fixed

- Lint script now scopes to `../extension-src` and exits 0 on a clean tree
  (was previously walking unrelated build output).
- Toolbar/store icons regenerated at exact 16/48/128/440/1400 sizes with
  consistent rounded-rectangle geometry.

### Test coverage

- 70/70 tests passing (29 → 70). New suites:
  `extension-src/capture/__tests__/shadow.test.ts` (12),
  `extension-src/capture/__tests__/inlineFonts.test.ts` (9),
  `extension-src/capture/__tests__/inlineIframes.test.ts` (6),
  `extension-src/panel/__tests__/telemetry.test.ts` (11),
  `extension-src/element/__tests__/elementTelemetry.test.ts` (3).

### Package

- `public/llm-export.zip`: 171 KB (well under the 1.5 MiB AC-BD-2 budget).
- `public/llm-export.zip.sha256`: refreshed.

## [1.0.0] — 2026-05-06

Initial release. Full-Page and Element export modes, floating panel,
keyboard shortcuts (`Alt+Shift+E` / `P`), settings persistence,
sticky-header handling, password-field redaction, and a 29-test unit
suite. See `spec/21-app/` for the implementation specification.