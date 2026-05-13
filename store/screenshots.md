# Screenshot shot list

## Required by the Chrome Web Store

- 1 to 5 screenshots, **1280×800** or **640×400**, PNG or JPEG.
- 1 small promo tile (440×280), PNG or JPEG.
- 1 marquee promo tile (1400×560), PNG or JPEG (optional but boosts
  featured placement).
- 128×128 store icon (already shipped at `extension-src/icons/icon-128.png`).

## Shot list (in order)

1. **Hero — floating panel on a real article**
   Capture the panel docked top-right on a long news article. Show the
   four export-mode buttons clearly. Caption: *"Capture any page the
   way your browser sees it."*
2. **Pick Element preview**
   Picker overlay highlighting a card component with the tooltip
   showing tag + class. Caption: *"Right-click any element to export
   just that piece."*
3. **The bundle**
   File-explorer view of an unzipped capture (`page.html`,
   `styles.css`, `scripts.js`, `screenshot.png`, `manifest.json`,
   `prompt.md`). Caption: *"Everything an LLM needs, in one ZIP."*
4. **AI instruction block in clipboard**
   Screenshot of ChatGPT (or Claude) with the auto-pasted instruction
   block + three Share Links visible. Caption: *"Share Links: three
   URLs that expire in 24 hours, hosted on your own WordPress."*
5. **Settings**
   Settings panel with the redaction toggle, naming template, and
   WordPress credentials section. Caption: *"Local-only by default.
   Configure WordPress to enable Share Links."*

## How to capture (deterministic recipe)

1. Load the unpacked extension from `public/inspect-page.zip` in a clean
   Chrome profile at exactly **1280×800** window size (the Web Store
   prefers no DPR scaling — disable HiDPI in the OS for the run).
2. Open the target page, mount the panel, perform the action.
3. Use the OS screenshot tool, crop to the inner content (no Chrome
   chrome).
4. Save to `store/assets/screenshot-N.png` (folder is git-ignored;
   regenerate per release).

## Promo tiles

- Small (440×280): centered Inspect Page wordmark on the brand background,
  one-line subtitle "Export pages for your LLM".
- Marquee (1400×560): same wordmark left-aligned, a faux ZIP bundle
  diagram on the right (HTML / CSS / JS / PNG icons).