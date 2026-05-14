# Release notes — Inspect Page v2.5.1

_Released 14 May 2026 · Extension `2.5.1` · WP plugin `2.4.0` (unchanged)_

## Highlights

**On-page picker chip — no more right-click required.** While the picker
is active, the `W × H` size badge is now part of a clickable chip group
rendered directly on the page:

- **✓ Select element** — same effect as right-clicking or pressing Enter.
- **⧉ Copy selector** — copies the short CSS selector
  (`tag#id` / `tag.cls1.cls2`) and flashes a "Copied" tag inside the chip.
- **✕ Cancel picker** — tears down the picker without leaving the page.

Hovering the chip freezes the current highlight (`chipHover` short-circuits
pointer re-targeting) so you can aim for the action button without the
highlighted element shifting under your cursor. The chip auto-flips above
the element when there isn't room below. Right-click and Enter still work
as redundant Select shortcuts.

**Inspector toolbar fix.** The Copy selector / Set anchor / Show code
buttons inside each Inspector row no longer render as stacked underlined
links — they're now grouped in a `.lpe-inspector-actions` toolbar with a
top divider and themed bordered buttons. Root cause was a duplicate
`.lpe-link` rule in `panel/styles.css` (added for the Smart Share dialog,
but never actually used by it) that was clobbering the inspector buttons.

## Test coverage

158/158 unit tests pass. New test file
`extension-src/picker/__tests__/chip.test.ts` covers chip mount + button
wiring + Cancel teardown.

## Full changelog
See [`CHANGELOG.md`](../CHANGELOG.md#extension-251--2026-05-14).

## Upgrade notes

- WP plugin 2.4.0 is unchanged — no plugin update required for v2.5.1.
- Existing Smart Share sessions and licenses are unaffected.
- Manifest version is `2.5.1`; users on the Web Store will pick it up via
  the standard auto-update channel (no permission changes).
- If you self-host the unpacked extension, drop `chrome://extensions`,
  remove the previous folder, and reload from the new
  `public/inspect-page.zip` (sha256 in `inspect-page.zip.sha256`).