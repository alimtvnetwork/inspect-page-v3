# Inspect Page — Chrome Web Store listing copy (v2.5.0)

## Name
Inspect Page — Export pages for ChatGPT, Claude & Gemini

## Short description (132 char max)
Export any web page or single element as Markdown, ZIP, or shareable URLs your AI can read. Built-in DOM/CSS inspector. No setup.

## Detailed description

**Inspect Page turns any web page into AI-ready context in one click.**

Pick a whole page or just one element, and Inspect Page hands you back a clean
Markdown file, a ZIP bundle, or four short HTTPS URLs you can paste into
ChatGPT, Claude, or Gemini. No more copy-pasting a screenshot and praying the
model can read it.

### What you can do

- **Export Page** — full-page HTML + CSS + JS + a stitched screenshot, with
  fonts inlined and shadow DOM expanded.
- **Pick Element** — point at any element on the page; get its outer HTML,
  matched CSS rules, computed style overrides, and a context screenshot.
- **Four export modes**, same on both flows:
  - **MD single** — one Markdown file with images base64-inlined.
  - **MD + files** — Markdown plus a `/assets` folder of real images.
  - **ZIP** — everything plus a `prompt.md` your model already knows how to read.
  - **Smart Share** — uploads to your own WordPress site and returns four
    public 24-hour URLs (HTML, CSS, JS, screenshot) plus a paste-ready AI
    instruction block.

### Built-in inspector (new in 2.5)

Pick Element now opens a rich inspector docked in the side panel:

- Identity, box-model diagram, full text properties.
- Selection foreground / background colors with WCAG contrast verdict
  (Excellent / Good / Poor / Fail) and AA / AAA pass-fail tags that respect
  the WCAG large-text rule.
- Code drawer with matched CSS split by `:base / :hover / :focus / :active /
  :disabled` and computed-style overrides grouped into Layout / Typography /
  Background / Border / Effects.
- Picker overlay with margin / padding rulers, size chip, **Alt-held
  distance guides** to viewport edges, and full keyboard navigation
  (↑ parent, ↓ first child, ←→ siblings, Enter to select, Esc to cancel).

### Privacy

Inspect Page captures the page you're on **only when you click an export
button.** Smart Share uploads go to *your own* WordPress site — there is no
Inspect Page server in the loop. Free plan: 5 lifetime Smart Shares per
WordPress account. Pro: unlimited, billed via Stripe ($5/mo, cancel anytime).

### Permissions

- `activeTab` — read the page you're exporting (only on click).
- `scripting` — inject the capture worker into the active tab.
- `storage` — remember your settings.
- `downloads` — save the exported files to disk.
- Host permissions for your own WP site only when you opt into Smart Share.

## Category
Developer Tools

## Languages
English (US)

## Support email
support@inspect-page.app

## Privacy policy URL
https://inspect-page.app/privacy