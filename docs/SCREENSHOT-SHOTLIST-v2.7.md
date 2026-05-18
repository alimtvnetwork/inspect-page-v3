# Inspect Page 2.7.0 — Chrome Web Store screenshot shot-list

Five 1280×800 PNGs, sRGB, no transparency. Saved to
`store-assets/screen-{1..5}.png` (overwrite). Take them on a clean
Chrome profile with the v2.7.0 unpacked extension loaded against a
throwaway WordPress install running `inspect-page` plugin v2.6.0.

The whole set must use the **Blueprint light-mint** theme (the popup
and WP admin tokens introduced in extension 2.6.3 / plugin 2.5.5 —
soft white background, deep ink text, mint accent). If you see the
older neutral-grey popup, hard-reload the extension and confirm
`--lpe-accent` resolves to the mint hex in DevTools before shooting.

Common rules

- Browser: Chrome stable, default theme, no other extensions visible
  in the toolbar except Inspect Page.
- Window chrome: include the URL bar so reviewers see we operate on
  real pages; hide bookmarks bar.
- Zoom: 100%. Device pixel ratio 1. macOS or Linux — no Windows
  taskbar.
- DO NOT show: pairing tokens, "Application Password", PPT1, the word
  "Bearer", raw Stripe secret keys, real customer email addresses,
  or any per-user `inspect_page_license` meta UI. Anything mentioning
  those is a reshoot.
- Workspace name in every shot: **Acme Design** (mock workspace on
  `demo.inspect-page.app`). Member roster is Alice (owner), Bob
  (admin), Carol (member). All three are `@demo.inspect-page.app`
  addresses — never use real emails.
- Caption overlay: 48 px Inter SemiBold, white on a 60% black bottom
  band, 80 px tall, full width. Keep under 60 chars.

## screen-1.png — Hero: Full Page export on a real article

- URL bar: `https://en.wikipedia.org/wiki/HTTP`
- State: Inspect Page floating panel open in the bottom-right of the
  viewport, mode = **Full Page**, format = **ZIP**, the four mode
  chips visible (MD, MD+files, ZIP, Smart Share). "Export" button
  hover state. The new workspace pill at the top of the panel reads
  **Acme Design · Pro**.
- Caption: "Capture any page — HTML, CSS, JS, full-page screenshot"

## screen-2.png — Pick Element overlay + on-page picker chip

- URL bar: `https://stripe.com`
- State: Element picker active. Highlight the hero CTA card with the
  mint dashed outline + tag/size readout above it. The on-page picker
  chip is visible right next to the size badge with its three icons
  (✓ Select, ⧉ Copy selector, ✕ Cancel). Floating panel in Pick
  Element mode, format = **MD + files**.
- Caption: "Pick one element — and act on it without leaving the page"

## screen-3.png — Smart Share popup with workspace picker (NEW for 2.7.0)

- URL bar: `https://news.ycombinator.com/`
- State: Extension popup (not the in-page panel) open over the page,
  Settings section expanded, showing:
  - Signed in as: `Alice Example`
  - **Workspace `<select>` dropdown** open, listing:
    - `Acme Design (owner)`  ← highlighted as current
    - `Alice's Workspace (owner)`
  - Workspace row immediately below the picker reads
    `Acme Design · Owner · Pro`
  - Plan badge: **Pro**
  - Quota readout: `Pro plan — unlimited shares`
  - Recent Shares header underneath with one row visible
    (`stripe.com · zip · 👁 4`).
- MUST NOT show any token, password, Stripe customer id, or "paste
  here" field.
- Caption: "Switch workspaces. Shared Pro billing for the whole team."

## screen-4.png — Inspect Page Workspaces admin (NEW for 2.7.0)

- URL bar: `https://demo.inspect-page.app/wp-admin/tools.php?page=inspect-page-workspaces`
- State: WordPress admin in the Blueprint light-mint theme, the
  **Tools → Inspect Page Workspaces** page open, showing:
  - Workspace switcher (top) set to **Acme Design**.
  - Members table with three rows: Alice (owner), Bob (admin), Carol
    (member). Each row has a role `<select>` and a Remove button.
    The "Transfer owner" action is visible on Alice's row.
  - Pending invites table with one row:
    `dave@demo.inspect-page.app · member · expires in 6d 22h ·
    Resend / Revoke`.
  - "Invite teammate" form at the bottom with email + role + Send.
- Caption: "Invite teammates. Owner / Admin / Member roles, email invites."

## screen-5.png — AI instruction block pasted into ChatGPT

- URL bar: `https://chat.openai.com/`
- State: a fresh chat with the AI instruction block visible in the
  composer, referencing the four URLs returned by Smart Share
  (`index.html`, `style.css`, `script.js`, `preview.png`) hosted at
  `demo.inspect-page.app/share/A1b2C3/...`. Don't actually send.
- Caption: "Paste once. Your LLM gets the page exactly as you saw it."

## After capture

1. Save as `store-assets/screen-{1..5}.png` (overwrite existing).
2. Verify each is exactly 1280×800: `identify store-assets/screen-*.png`
3. Confirm no banned wording:
   `rg -l -i "pairing|application password|PPT1|bearer|sk_live_|pageport|llm export" store-assets/`
4. Re-run the Chrome Web Store submission flow with
   `store-assets/listing-2.7.0.md` as the listing copy + "Recent
   changes" source. Screenshot-only updates do not reset review, but
   we're shipping a manifest bump too (2.5.x → 2.7.0) so expect a
   full review pass.
