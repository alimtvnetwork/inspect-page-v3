# Implementation Plan — LLM Page Export Chrome Extension

Mirrors `.lovable/plan.md`. Source of truth for phase tracking.

## Locked decisions
- UI: Toolbar popup AND injected floating panel.
- Full Page bundle: Single `.zip` via JSZip.
- Element CSS: Computed styles + matched rules + `outerHTML`.
- Full-page screenshot: Scroll-and-stitch via `chrome.tabs.captureVisibleTab`.

## Phases
0. Spec — write all files under `spec/21-app/`. (current)
1. Skeleton — Vite + TS + MV3 manifest, popup shell, service worker, content script, build to `public/llm-export.zip`.
2. Floating panel + popup UI — two buttons, status, close/minimize, Esc.
3. Full Page export — HTML + CSS + JS collection + ZIP.
4. Scroll-and-stitch screenshot — offscreen canvas, sticky handling, append to ZIP.
5. Element picker — overlay outline, tooltip, right-click export, Esc cancels.
6. Element export — computed + matched CSS + outerHTML + 2 screenshots, Base64 in `.md`.
7. Polish — error surfacing, settings, naming, smoke tests, package final ZIP.

User drives progression with "next".
