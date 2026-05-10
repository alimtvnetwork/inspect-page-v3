# Pre-publish checklist

Run this end-to-end before every Web Store upload. Tick items in the
PR that bumps `manifest.json` version.

## Build artifacts
- [ ] `manifest.json` version bumped (semver) and matches `package.json`.
- [ ] `bun run lint` and `bunx vitest run` both exit 0.
- [ ] `bun run build && bun run package` produced a fresh
      `public/pageport.zip` ≤ 1.5 MiB.
- [ ] `wp-plugin/scripts/package.sh` produced a fresh
      `public/pageport-wp.zip` (only if WP plugin changed).
- [ ] Loaded the rebuilt unpacked folder in `chrome://extensions` with
      zero warnings.

## Listing assets
- [ ] All shots in `store/screenshots.md` regenerated against the new
      build at exactly 1280×800.
- [ ] Promo tiles (440×280, 1400×560) regenerated.
- [ ] 128×128 icon unchanged (or refreshed if branding changed).

## Listing copy
- [ ] `store/listing.md` reviewed for date-sensitive claims.
- [ ] `store/permissions.md` re-checked against the actual
      `manifest.json` permissions array — no permission added without
      a justification row.
- [ ] `store/privacy.md` "Last updated" date refreshed if the policy
      itself changed.
- [ ] Privacy policy URL on the listing form points to the live
      `/privacy` route on the landing site, and that page renders.

## Functional smoke (against installed build)
- [ ] Full Page export on a long article produces a ZIP that opens.
- [ ] Pick Element on a complex card produces a `.md` with both
      screenshots embedded.
- [ ] All four export modes work in both flows (AC-EM-1..6).
- [ ] Share Links round-trip succeeds against a WordPress staging
      site; clipboard contains the instruction block.
- [ ] Settings panel opens, persists, and the redaction toggle is on
      by default.
- [ ] Keyboard shortcuts trigger Full Page and Pick Element.
- [ ] On a `chrome://` URL the toolbar action shows the
      `E_NOT_AVAILABLE_HERE` tooltip and does not crash the SW.

## Privacy / policy compliance
- [ ] No new permission since the previous version (or, if added, a
      reviewer-friendly explanation in the version notes).
- [ ] No remote code introduced (no new `<script src=…>`, no `eval`
      of fetched strings).
- [ ] No new outbound host beyond `<all_urls>` page-asset fetches and
      the user-configured WordPress site.
- [ ] Data usage disclosure checkboxes in the listing form still
      match `store/permissions.md`.

Only when every box is checked: hit "Submit for review".