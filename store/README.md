# Chrome Web Store listing assets — Inspect Page

This folder is the source of truth for the Chrome Web Store submission.
Everything here is plain markdown / text so it can be reviewed and edited
without opening a graphics tool. Image assets are referenced by spec, not
included as binaries — generate them right before submission so they
reflect the latest UI.

## Files

- `listing.md` — short name, summary, full description, category.
- `permissions.md` — single-purpose statement + per-permission justification text required by the Web Store review questionnaire.
- `privacy.md` — long-form privacy policy. Mirrored on the landing site at `/privacy`.
- `screenshots.md` — required screenshot dimensions, captions, and a shot list.
- `submission-checklist.md` — final pre-publish gating list.

## Process

1. Bump `manifest.json` version + rebuild (`bun run build && bun run package`).
2. Refresh screenshots per `screenshots.md` against the new build.
3. Re-read `submission-checklist.md` end to end.
4. Upload `public/inspect-page.zip` in the Web Store dev dashboard.
5. Paste copy from `listing.md` and `permissions.md` into the listing form.
6. Set the privacy policy URL to the `/privacy` page on the landing site.