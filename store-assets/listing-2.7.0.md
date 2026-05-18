# Inspect Page — Chrome Web Store listing copy (v2.7.0)

_Submit this version when uploading `public/inspect-page.zip` (extension manifest 2.7.0, paired with WP plugin 2.6.0) to the Chrome Web Store. Diff vs `listing-2.5.1.md`: new **Team Workspaces** section + workspace picker bullet under Smart Share + refreshed Privacy paragraph + new "What's new" blurb._

## Name
Inspect Page — Export pages for ChatGPT, Claude & Gemini

## Short description (132 char max)
One-click pick + export — Markdown, ZIP, or shareable URLs your AI can read. Now with team workspaces and shared Pro billing.

## Detailed description

**Inspect Page turns any web page into AI-ready context in one click — solo or with your team.**

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

### NEW in 2.7.0 — Team Workspaces

Invite teammates into a shared workspace on your own WordPress site:

- **Roles** — Owner, Admin, Member. Owners and admins manage billing and
  invites; members share freely against the workspace's quota.
- **Workspace-aware Smart Share** — the popup now shows a workspace picker.
  Switch workspaces and the plan badge, Recent Shares list, and "Free shares
  used: X / 5" counter all update to match.
- **Shared Pro billing** — one Stripe subscription per workspace, not per
  seat. Upgrade once and every member gets unlimited Smart Shares against
  that workspace.
- **Email invites** — single-use 7-day tokens, opened through a hidden
  `inspect-page-accept` admin page. Existing solo users are migrated into
  their own workspace automatically on plugin upgrade.

### Built-in inspector

Pick Element opens a rich inspector docked in the side panel:

- Identity, box-model diagram, full text properties.
- Selection foreground / background colors with WCAG contrast verdict
  (Excellent / Good / Poor / Fail) and AA / AAA pass-fail tags that respect
  the WCAG large-text rule.
- Code drawer with matched CSS split by `:base / :hover / :focus / :active /
  :disabled` and computed-style overrides grouped into Layout / Typography /
  Background / Border / Effects.
- On-page picker chip — while the picker is active, the size badge becomes
  a clickable chip with **✓ Select**, **⧉ Copy selector**, and **✕ Cancel**
  buttons. Hovering the chip freezes the highlight so you can aim without it
  retargeting under your cursor.
- Picker overlay with margin / padding rulers, **Alt-held** distance guides
  to viewport edges, and full keyboard navigation (↑ parent, ↓ first child,
  ←→ siblings, Enter to select, Esc to cancel).

### Privacy

Inspect Page captures the page you're on **only when you click an export
button.** Smart Share uploads go to *your own* WordPress site — there is no
Inspect Page server in the loop. Workspace data (members, invites, Stripe
customer ids) lives entirely in your WordPress database. Free plan: 5
lifetime Smart Shares per workspace. Pro: unlimited, billed via Stripe
($5/mo, cancel anytime).

### Permissions

- `activeTab` — read the page you're exporting (only on click).
- `scripting` — inject the capture worker into the active tab.
- `storage` — remember your settings (including the last selected workspace).
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

## What's new (Web Store "Recent changes" field, ≤ 1000 chars)

v2.7.0 — Team Workspaces. Invite teammates into a shared workspace on your own WordPress site with owner / admin / member roles. The popup now has a workspace picker — switch workspaces and the plan badge, Recent Shares list, and free-quota counter all update to match. Shared Pro billing: one Stripe subscription per workspace gives every member unlimited Smart Shares. Existing solo accounts are auto-migrated into their own workspace on plugin upgrade and keep all prior Pro entitlements. Requires WordPress plugin v2.6.0 — older plugins still work, the workspace UI is hidden automatically. No breaking changes for solo users.
