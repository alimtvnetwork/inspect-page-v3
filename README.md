# Inspect Page

Export any web page (or one element) as HTML, CSS, JavaScript, and a
full-page screenshot — bundled into a single artifact your LLM can
actually work with.

This monorepo ships three things:

| Folder | What |
|---|---|
| `extension/` + `extension-src/` | Chrome MV3 extension (v2.5.9). Build with `cd extension && bun run build && bun run package` → outputs `public/inspect-page.zip`. |
| `wp-plugin/inspect-page/` | Companion WordPress plugin (v2.5.4) that powers Smart Share + Stripe billing. Distributed as `public/inspect-page-wp.zip`. |
| `src/` | Lovable landing site (download links, docs, privacy). |

## Export modes

1. **MD single** — base64-inline screenshot, one `.md` file.
2. **MD + files** — `.zip` with `prompt.md` and assets.
3. **ZIP** — full bundle with `prompt.md`.
4. **Smart Share** *(requires WP plugin)* — uploads to the user's own
   WordPress site and returns 4 short public URLs
   (`index.html`, `style.css`, `script.js`, `preview.png`),
   valid for 24 hours, plus a ready-to-paste AI instruction block.

## Smart Share auth

Standard WordPress login cookie + `X-WP-Nonce`. No pairing tokens, no
Application Passwords. Sign-in opens the hidden `inspect-page-bridge` admin
page and the bridge sends a `wp_rest` nonce back to the extension via
`postMessage`. Per-WP-user quota: 30 active sessions, 60 uploads/hour, and
a lifetime free Smart Share quota of **5** — beyond that the popup shows an
inline **Upgrade to Pro** CTA that opens Stripe Checkout.

As of v2.5.9 the onboarding **Sign in** button and the signed-out
**Share Links** button open the WP bridge tab directly — no detour through
Settings.

## Popup UX (v2.5.9)

- **Settings** opens as a full popup overlay (no peeking export UI behind
  it) with a native-styled dark `<select>` chevron.
- **Inspect** tab paints a shimmer skeleton on first frame, then fills in
  the snapshot asynchronously via `requestIdleCallback`. Subsequent opens
  paint instantly from a module-scoped cache; the ↻ header button forces a
  re-collect.
- **Recent Shares** rows show a 36×36 preview thumbnail and a `👁 N` badge
  that expands to a per-file breakdown + last-viewed timestamp.

## Specs

- `spec/21-app/24-export-modes.md` — Export modes
- `spec/21-app/25-share-links.md` — WP plugin layout, REST routes, security
- `spec/21-app/26-implementation-order-v2.md` — Build order
- `spec/21-app/11-acceptance-criteria.md` — Acceptance criteria
- `docs/QA-CHECKLIST.md` — Manual QA before release
- `docs/ACCEPTANCE-v2.2.md` — Live Smart Share acceptance pass (+ §9 analytics)
- `docs/PHASE-6-LAUNCH-CHECKLIST.md` — Pre-launch gate (targets v2.5.9 / WP 2.5.4)
