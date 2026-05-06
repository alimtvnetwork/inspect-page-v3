# 00 — Overview

## Verbatim brief
A Chrome extension (Manifest V3) that opens a small UI panel on any website. From the panel the user can export:
1. The **full page** as HTML + merged CSS + merged JS + full-page screenshot, so an LLM can generate an overriding CSS layer.
2. A **picked element** as a Markdown file containing the element's CSS, a screenshot of it in page context, and a screenshot of it in isolation (both Base64-embedded).

## Goals
- Give an LLM enough structured context to reason about and restyle any web page.
- Zero server dependency — all work happens in the browser.
- Work on any site without per-site configuration.

## Non-goals
- Editing the live page.
- Persisting exports to cloud storage.
- Supporting non-Chromium browsers in v1.

## Primary users
Developers and designers iterating on UI with an LLM.
