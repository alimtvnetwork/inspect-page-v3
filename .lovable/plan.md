## What I'll fix

You've confirmed three things, so here's the plan. All work stays inside `extension-src/` (Chrome extension popup + floating panel). No landing-site changes. New build: **v2.7.6**.

### 1. Restore locked dark-mint theme (kill the gold)

Your stored theme drifted to `riseup-asia` (amber). The memory clearly locks the extension to dark-mint, so:

- change `riseup-asia`, `midnight-orange`, `slate-sky` presets from `extension-themes.ts`
- Add a one-time migration: on load, any stored `presetId` other than `dark-mint` (or a leftover custom amber accent) gets reset to `dark-mint` and re-saved.
- Strip the theme picker UI in `AppearanceSection.tsx` down to a static "Dark Mint" label (or remove the picker entirely — your call later).
- Audit `styles.css` for hard-coded amber/gold (`#f59e0b`, `#fbbf24`, `#d97706`, `#FF6600`) and route them through `--lpe-accent` or semantic warning tokens.

### 2. Fix the picker "stuck cancel bar" bug

When you click a non-pickable region (the panel itself, an iframe, or a blank area), the panel currently leaves you stranded on the "Cancel picker" view with no crosshair. Per your answer:

- In `picker-overlay.ts` / `picker-dom.ts`, when `elementFromPoint` returns null or hits the panel/shadow host, **swallow the click, keep picker active**, and surface a tiny inline hint "Not pickable — try another element" (auto-dismiss after 1.5s).
- Make sure the panel UI stays in `PickerActive` state — don't transition to `Cancelling` on a no-op click.
- Keep Escape and the explicit "Cancel picker" button as the only ways to actually exit.

### 3. Export tab: show everything at once

Right now, opening Export collapses most of the controls. You want all functionality visible immediately:

- In `ExportPanel.tsx` + `FullPageActions.tsx` + `ExportModes.tsx`, render both groups expanded by default:
  - **Re-download captured files** (Format toggle, HTML / CSS / JS / Screenshot / Download all zip)
  - **Export for AI** (MD / MD+files / ZIP / Share Links)
- Remove any conditional `if (capturedYet)` guard that hides the re-download block behind a warning. If nothing's captured yet, show the buttons in a disabled/ghost state with a one-line hint instead of a wall of warnings.
- Tighten spacing so the two sections fit cleanly in the 412×820 panel without overlap.

### 4. Fix hover-contrast & overlap bugs

From your screenshot of "Re-download captured files":

- Buttons go black-on-black on hover. Fix `.lpe-btn:hover` / `.lpe-btn-secondary:hover` so foreground stays `--lpe-fg` (mint-tinted off-white) and background uses `--lpe-surface-2`, never the accent fill.
- The "Re-download captured files" section header overlaps the Format toggle — add proper `margin-block` and gap between the header, format row, and button row.
- "Share Links" disabled button has near-invisible text — bump disabled opacity from whatever it is now to `--lpe-muted` at 0.7.

### 5. Bump version & rebuild

- `extension-src/manifest.json` 2.7.5 → 2.7.6
- `extension/package.json` matching bump
- Rebuild `public/inspect-page.zip` (+ sha256 + srchash)
- Append a v2.7.6 entry to `docs/PROJECT-DOCS.md` §9 (NOT a new file — memory rule).
- Update `src/components/landing/WhatsNew.tsx` to v2.7.6 with these four fixes summarised.

## Technical notes

- I will NOT touch `.lpe-btn-hero` / `.lpe-btn-ico` geometry guards (memory rule).
- I will NOT create new `docs/RELEASE-NOTES-*` files.
- Picker hint will live inside the existing shadow root so host CSS can't bleed in.
- The amber preset removal is one-way; if you later want the gold theme back I can restore it from git, but the memory says dark-mint is locked so I'm treating that as the source of truth.

## What I'm NOT doing this round

- No new features.
- No backend / WP plugin changes (no version bump there).
- No git tag — you push tags manually per your workflow.

## Remaining tasks (after this is shipped)

- Revoke leaked GitHub token, create new one with `workflow` scope
- Push `ext-v2.7.6` tag once this build lands
- CWS screenshots (1280×800)
- Upload `public/inspect-page.zip` v2.7.6 to Chrome Web Store
- **Deferred:** WP prod URL, Stripe live keys, `wp-v2.6.0` tag

Approve and I'll execute all four fixes in one pass.