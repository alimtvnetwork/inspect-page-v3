# 00 — Overview

## Verbatim brief
A Chrome extension (Manifest V3) that opens a small UI panel on any website. From the panel the user can export:
1. The **full page** as HTML + merged CSS + merged JS + full-page screenshot, so an LLM can generate an overriding CSS layer.
2. A **picked element** as a Markdown file containing the element's CSS, a screenshot of it in page context, and a screenshot of it in isolation (both Base64-embedded).

## Goals
- Give an LLM enough structured context to reason about and restyle any web page.
- Zero server dependency — all work happens in the browser.
- Work on any site without per-site configuration.
- Produce outputs that are **deterministic** for a given page state (same input → same files modulo timestamp).

## Non-goals (v1)
- Editing the live page.
- Persisting exports to cloud storage.
- Supporting Firefox / Safari.
- Capturing cross-origin iframe contents.
- Auto-uploading to an LLM.

## Personas
- **Developer**: wants raw HTML/CSS/JS to feed an LLM for refactoring or restyling.
- **Designer**: wants the element export to share a single component with an LLM for redesign.

## Success metrics (v1, manual)
- Full-page export completes in ≤ 15 s on a 10 000 px tall page on a mid-range laptop.
- Element export completes in ≤ 5 s.
- Output ZIP opens in any standard archiver.
- Markdown renders correctly in GitHub preview and in VS Code preview.

## Out-of-scope statement
Anything not in this folder is out of scope. If the implementing AI thinks a feature is missing, it MUST stop and request clarification rather than improvise.
