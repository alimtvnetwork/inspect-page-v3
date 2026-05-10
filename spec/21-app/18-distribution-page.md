# 18 — Distribution page (Lovable landing page)

A single page in the Lovable host project that distributes `public/pageport.zip`.

## Route
`/` (the landing page is the project's home route in this project).

## Goals
- One-click download of the unpacked extension ZIP.
- Clear "Load unpacked" instructions.
- Set expectations: v1, Chromium browsers only, no Web Store listing yet.

## Information architecture

```
┌──────────────────────────────────────────┐
│  HERO                                     │
│   H1: Export any web page for your LLM    │
│   Sub: HTML, CSS, JS and a full-page      │
│        screenshot — bundled in one ZIP.   │
│   [ Download extension ]                  │
│   small text: v{version} · {sizeKb} KB    │
├──────────────────────────────────────────┤
│  HOW IT WORKS  (3 steps)                  │
│   1. Open any site                        │
│   2. Click the extension or floating panel│
│   3. Choose "Full Page" or "Pick Element" │
├──────────────────────────────────────────┤
│  INSTALL (Load unpacked)                  │
│   1. Download the ZIP and unzip it.       │
│   2. Open chrome://extensions               │
│   3. Toggle "Developer mode" (top-right). │
│   4. Click "Load unpacked".               │
│   5. Select the unzipped folder.          │
├──────────────────────────────────────────┤
│  WHAT YOU GET                             │
│   - page.html / styles.css / scripts.js   │
│   - screenshot.png (full page)            │
│   - manifest.json (capture metadata)      │
│   - Element export → single .md file      │
├──────────────────────────────────────────┤
│  PRIVACY                                  │
│   Everything runs in your browser. No     │
│   network calls beyond fetching the page  │
│   you're already on.                      │
├──────────────────────────────────────────┤
│  FOOTER                                   │
│   © {year}  ·  v{version}                  │
└──────────────────────────────────────────┘
```

## Copy (verbatim)

| Slot | Text |
|---|---|
| H1 | Export any web page for your LLM |
| Sub | HTML, CSS, JavaScript and a full-page screenshot — bundled in one ZIP. |
| CTA primary | Download extension |
| CTA meta | v{version} · {sizeKb} KB |
| Step 1 | Open any site |
| Step 2 | Open the extension popup or the floating panel |
| Step 3 | Choose **Full Page** or **Pick Element** |
| Privacy line | Everything runs in your browser. No network calls beyond fetching the page you’re already on. |

`{version}` and `{sizeKb}` resolved at build time from `public/pageport.zip`.

## Download button behavior

- The Lovable preview environment requires authenticated fetches for static files. Use **fetch + blob**:
  1. `res = await fetch('/pageport.zip')`
  2. If `!res.ok` → show inline error `Download failed: {status}`.
  3. `blob = await res.blob()`.
  4. Create `<a href={URL.createObjectURL(blob)} download="pageport.zip">` and `.click()`.
  5. Revoke object URL.
- Disable button while in flight; show spinner.
- After success, show toast `Downloaded pageport.zip`.

## Sections rendered as components
- `Hero` (uses semantic `<header>` with `<h1>`).
- `HowItWorks` (`<section>` + ordered list).
- `InstallSteps` (`<section>` + ordered list, monospace for `chrome://extensions`).
- `WhatYouGet` (`<section>` + unordered list).
- `Privacy` (`<section>`).
- `Footer` (`<footer>`).

## SEO
- `<title>`: `PagePort — Chrome extension` (≤ 60 chars).
- `<meta name="description">`: `Export any webpage as HTML, CSS, JS and a full-page screenshot, ready for your LLM.` (≤ 160 chars).
- Single `<h1>`. Semantic landmarks. Alt text on any screenshots added later.
- `<link rel="canonical">` to deployed URL.
- JSON-LD `SoftwareApplication` with `name`, `applicationCategory: BrowserApplication`, `operatingSystem: Chromium`.

## Design
- Reuse host design tokens from `src/index.css` and `tailwind.config.ts`. No raw colors in components.
- Layout: `single-column`, max-width `720px`, generous whitespace, mono accents for shell paths.

## Responsiveness
- Single column from 320 px upward.
- CTA full-width below 640 px, auto width above.

## Out of scope (v1)
- No screenshots/video on the landing page.
- No analytics.
- No newsletter signup.
