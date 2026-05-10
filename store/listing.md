# Listing copy

## Name (max 45 chars)
PagePort — Export pages for your LLM

## Short summary (max 132 chars)
Export any web page (or one element) as HTML, CSS, JS and a full-page screenshot — bundled for ChatGPT, Claude, and Gemini.

## Category
Developer Tools

## Language
English (United States)

## Detailed description (≤16 000 chars)

PagePort packages whatever is on screen into a tidy ZIP — HTML, CSS,
JavaScript, and a true full-page screenshot — so you can hand it to an
LLM in one paste.

### Why

Pasting a URL into ChatGPT, Claude, or Gemini works only when the model
can fetch the page. Most of the time it can't: the site is behind a
login wall, the layout depends on JavaScript that the model's browser
tool refuses to run, the page is too long for the assistant's crawler,
or you're working from a localhost build that has no public URL at all.
PagePort sidesteps every one of those failure modes by snapshotting
exactly what your browser already rendered.

### What you get

- **Full Page export** — one ZIP containing `page.html`, `styles.css`,
  `scripts.js`, a `screenshot.png` of the entire scroll height, and a
  `manifest.json` describing the capture.
- **Pick Element export** — right-click any element to get a single
  `.md` file with its outerHTML, matched CSS rules, computed-style diff,
  an in-context screenshot, and an isolated render of just that
  component — perfect for "redesign this card" prompts.
- **Four export modes** for both flows: a self-contained Markdown file,
  Markdown + extracted assets, a full ZIP with an LLM-ready
  `prompt.md`, or Share Links — three short URLs (HTML, CSS,
  screenshot) that expire in 24 hours, hosted by your own WordPress
  site via the optional companion plugin.
- **Floating panel** that you can drag, dock, and remembers its
  position per site.
- **Keyboard shortcuts** for instant capture without opening the panel.
- **Reduced-motion respected**, full keyboard navigation, screen-reader
  labels.

### Privacy

PagePort is fully local. There is no telemetry, no analytics, no
remote configuration. The only network traffic the extension itself
initiates is fetching stylesheets and scripts that the page already
references, and (only if you explicitly configure it) uploading a
capture to your own WordPress site for the Share Links feature. We
never read cookies, history, bookmarks, or other tabs.

Password fields are redacted by default before any export is written.

Full policy: https://pageport.app/privacy

### Permissions in plain English

- `activeTab`, `tabs`, `scripting` — run on the tab you click on.
- `downloads` — save the ZIP / Markdown to your Downloads folder.
- `storage` — remember your settings and panel position.
- `offscreen` — own a hidden canvas for stitching the full-page
  screenshot (Chrome service workers have no DOM).
- Host permission `<all_urls>` — needed because you may invoke the
  extension on any site you visit. PagePort only acts on the tab you
  trigger it on; it does not background-scan the web.

### Open source & support

PagePort is MIT-licensed. File issues, request features, or read the
full architectural specification at https://pageport.app.