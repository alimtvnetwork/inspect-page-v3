# PagePort 2.2 — Chrome Web Store screenshot shot-list

Five 1280×800 PNGs, sRGB, no transparency. Saved to
`store-assets/screen-{1..5}.png` (overwrite). Take them on a clean
Chrome profile with the v2.2.0 unpacked extension loaded against a
throwaway WordPress install whose `pageport` plugin is also v2.2.0.

Common rules

- Browser: Chrome stable, default theme, no other extensions visible
  in the toolbar except PagePort.
- Window chrome: include the URL bar so reviewers see we operate on a
  real page; hide bookmarks bar.
- Zoom: 100%. Device pixel ratio 1. macOS or Linux — no Windows
  taskbar.
- DO NOT show: pairing tokens, "Application Password", PPT1, the word
  "Bearer", or any 3-URL share output. Anything mentioning those is a
  reshoot.
- Caption overlay: 48 px Inter SemiBold, white on a 60% black bottom
  band, 80 px tall, full width. Keep under 60 chars.

## screen-1.png — Hero: Full Page export on a real article

- URL bar: `https://en.wikipedia.org/wiki/HTTP`
- State: PagePort floating panel open in the bottom-right of the
  viewport, mode = **Full Page**, format = **ZIP**, the four mode
  chips visible (MD, MD+files, ZIP, Smart Share). "Export" button
  hover state.
- Caption: "Capture any page — HTML, CSS, JS, full-page screenshot"

## screen-2.png — Pick Element overlay

- URL bar: `https://stripe.com`
- State: Element picker active. Highlight the hero CTA card with the
  blue dashed outline + tag/size readout above it. Floating panel in
  Pick Element mode, format = **MD + files**.
- Caption: "Right-click any element. Get just the parts you need."

## screen-3.png — Smart Share: signed-in panel

- URL bar: `https://news.ycombinator.com/`
- State: Settings → Smart Share section of the floating panel,
  showing:
  - Site URL: `https://demo.pageport.app`
  - Signed in as: `Alice Example` `<alice@demo.pageport.app>`
  - "Sign out" link
  - Quota readout: `2 / 30 active · 4 / 60 uploads this hour`
- MUST NOT show any token, password, or "paste here" field.
- Caption: "Sign in with your normal WordPress login. No tokens."

## screen-4.png — Smart Share dialog: 4 URLs + countdown

- URL bar: any (the source page is irrelevant; the dialog is the
  subject).
- State: Share dialog modal centered on the page, showing:
  - Heading: "Smart Share — 4 links ready"
  - Four rows, each with a per-row Copy button:
    - `https://demo.pageport.app/share/A1b2C3/index.html`
    - `https://demo.pageport.app/share/A1b2C3/style.css`
    - `https://demo.pageport.app/share/A1b2C3/script.js`
    - `https://demo.pageport.app/share/A1b2C3/preview.png`
  - Live countdown: `Expires in 23h 58m 14s`
  - Buttons: "Copy AI prompt + 4 URLs" (primary), "Revoke now" (danger
    secondary).
- Caption: "Four shareable URLs + AI prompt. Revoke any time."

## screen-5.png — AI instruction block pasted into ChatGPT

- URL bar: `https://chat.openai.com/`
- State: a fresh chat with the AI instruction block visible in the
  composer, referencing the four URLs from screen-4 (`index.html`,
  `style.css`, `script.js`, `preview.png`). Don't actually send.
- Caption: "Paste once. Your LLM gets the page exactly as you saw it."

## After capture

1. Save as `store-assets/screen-{1..5}.png` (overwrite existing).
2. Verify each is exactly 1280×800: `identify store-assets/screen-*.png`
3. Confirm no pairing-era wording: `rg -l -i "pairing|application password|PPT1|bearer" store-assets/`
4. Re-run the Chrome Web Store submission flow — no manifest version
   change required, screenshot-only update is allowed without review
   reset.