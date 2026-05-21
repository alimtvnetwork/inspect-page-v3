# .gitmap/release/

Machine-readable registry of every published GitHub Release for Inspect Page.
Mirrors the macro-ahk-v34 release-registry pattern.

## Files

- `latest.json` — pointer to the most recent published (non-draft, non-pre) release across **all** kinds.
- `<tag>.json` — one entry per release tag. Tag format: `ext-vX.Y.Z` (extension) or `wp-vX.Y.Z` (WP plugin).

## Schema

```json
{
  "version": "2.7.5",
  "tag": "ext-v2.7.5",
  "kind": "ext",
  "commit": "main",
  "branch": "main",
  "assets": [
    { "name": "inspect-page.zip", "url": "...", "size": 332256, "sha256": "..." }
  ],
  "isDraft": false,
  "isPreRelease": false,
  "createdAt": "2026-05-21T00:00:00Z",
  "publishedAt": "2026-05-21T00:00:00Z",
  "isLatest": true
}
```

## Maintenance

`.github/workflows/release-watcher.yml` updates this directory automatically on every GitHub Release `published` event. Seed entries (`ext-v2.7.5.json`, `wp-v2.6.0.json`) are hand-written and will be overwritten by the watcher once the corresponding tags are pushed.

`.github/workflows/audit-releases.yml` runs weekly to verify every registry entry has a matching live GitHub Release.