# 06 — Versioning

## Version Format

Both artifacts use **semver-lite**: `MAJOR.MINOR.PATCH` — e.g. `2.7.5`.

- **MAJOR**: breaking changes (rare).
- **MINOR**: new features, refactors, non-trivial behavior changes.
- **PATCH**: bug fixes only.

## Policy

- **Every code change** must bump at least the minor version of the
  affected artifact. Marketing-only / pipeline-only commits do not bump
  artifact versions.
- **All version files must be in sync** within their artifact — enforced
  by `check-version-sync.mjs` (extension) and `check-wp-version-sync.mjs`
  (plugin).
- **The two artifacts version independently.** Extension `v2.7.5` does
  not require WP plugin `v2.7.5`. They share infrastructure (CI, scripts,
  validators) but ship on independent cadences.

## Files That Carry the Extension Version

| # | File                                          | Format                                 |
|---|-----------------------------------------------|----------------------------------------|
| 1 | `extension/package.json`                      | `"version": "X.Y.Z"`                   |
| 2 | `extension-src/manifest.json`                 | `"version": "X.Y.Z"`                   |
| 3 | `src/components/landing/WhatsNew.tsx`         | most-recent entry `version: "X.Y.Z"`   |
| 4 | `docs/PROJECT-DOCS.md`                        | `Current shipped: Extension vX.Y.Z`    |

## Files That Carry the WP Plugin Version

| # | File                                          | Format                                 |
|---|-----------------------------------------------|----------------------------------------|
| 1 | `wp-plugin/inspect-page/inspect-page.php`     | `Version:` plugin header               |
| 2 | `wp-plugin/inspect-page/inspect-page.php`     | `define( 'INSPECT_PAGE_VERSION', 'X.Y.Z' )` |
| 3 | `wp-plugin/inspect-page/readme.txt`           | `Stable tag: X.Y.Z`                    |
| 4 | `docs/PROJECT-DOCS.md`                        | `… + WP plugin vX.Y.Z`                 |

## Bump Process

### Extension

1. `bun run scripts/ci/bump-ext.mjs minor` (or `patch` / `major`) — updates
   all 4 files atomically. (Script lives in `scripts/ci/`, ships in
   Phase 2.)
2. Run `bun run scripts/ci/check-version-sync.mjs --expect X.Y.Z`.
3. Append a section to `docs/PROJECT-DOCS.md §9`.
4. Commit → branch `release/ext-vX.Y.Z` → push.
5. `release.yml` builds, packages, uploads.
6. Tag `ext-vX.Y.Z` is created by the release workflow (or you can push
   the tag directly to skip the branch).

### WP plugin

Same flow with `bump-wp.mjs`, branch `release/wp-vX.Y.Z`, tag
`wp-vX.Y.Z`.

## Known Drift (as of pipeline rollout)

| Artifact | File                                    | Value   | Expected | Action |
|----------|-----------------------------------------|---------|----------|--------|
| WP       | `wp-plugin/inspect-page/inspect-page.php` header | `2.5.5` | `2.6.0` | first WP release commit after pipeline lands must reconcile |
| WP       | `INSPECT_PAGE_VERSION` constant         | `2.5.5` | `2.6.0` | same                                                       |

CI will fail until this is fixed — that is intentional. The fix is a
one-line bump in two places.