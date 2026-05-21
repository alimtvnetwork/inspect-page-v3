# Inspect Page — Project Overview

Chrome extension + WordPress plugin that exports any web page (or a single element) into LLM-ready Markdown / ZIP / Smart Share artifacts.

## Shipped versions
- **Chrome extension:** v2.7.6
- **WordPress plugin:** v2.6.0

## Brand (strict)
Always "Inspect Page" — never "PagePort", "LLM Export", "LLM Page Export", or `llm-export`. Zips: `inspect-page.zip` / `inspect-page-wp.zip`. REST namespace `inspect-page/v1`. Plugin folder `wp-plugin/inspect-page/`.

## Scope default
Every user request targets the **Chrome extension** (`extension-src/` + `wp-plugin/inspect-page/`), NOT the marketing site (`src/`). Touch `src/` only when the user says "landing", "website", "marketing", "WhatsNew", or names a file under `src/`.

## Theme (locked)
Dark-mint: bg `#0B0F0E`, fg `#F5FFFA`, surface `#111715`, accent `#2DD4A8` → glow `#73FFB8`, primary gradient `linear-gradient(135deg,#2DD4A8,#73FFB8)`. Popup and floating panel both use it. Do not repaint without explicit request.

## Single source of truth
`docs/PROJECT-DOCS.md` — capabilities, acceptance criteria, launch runbook, pen-test, release history, QA, GitHub release template. Append new releases to §9 there; do NOT create per-version files under `docs/`.
