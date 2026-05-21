# 08 — Troubleshooting

Common failures and the fastest path to a fix.

## `verify` job fails with "brand name violation"

- **Cause**: a banned token (`PagePort`, `LLM Export`, `LLM Page Export`,
  `llm-export`) was introduced.
- **Fix**: run `node scripts/ci/check-brand-name.mjs` locally — the
  output lists every offending file:line. Replace with `Inspect Page` /
  `inspect-page`.
- **Hard rule**: do not add the path to an ignore list. The rule is
  absolute.

## `verify` job fails with "version mismatch"

- **Cause**: one of the version-bearing files drifted (commonly the
  marketing `WhatsNew.tsx` entry or the WP plugin header).
- **Fix**: run `node scripts/ci/check-version-sync.mjs` (or
  `check-wp-version-sync.mjs`). The output prints expected vs actual.
- **Quick path**: re-run the bumper (`scripts/ci/bump-ext.mjs` /
  `bump-wp.mjs`) with the target version.

## `verify` job fails with "sha256 stale"

- **Cause**: someone committed `public/inspect-page.zip` without
  regenerating its `.sha256`, or vice versa.
- **Fix**: run `bash scripts/release.sh` to repackage and refresh both
  zips and both digests in one shot.

## Release workflow fires but no GitHub Release appears

- **Cause 1**: tag pattern mismatch. Tags must be `ext-vX.Y.Z` or
  `wp-vX.Y.Z` — `v2.7.5` alone does not match.
- **Cause 2**: `GITHUB_TOKEN` lost write access (org policy). Re-grant
  in repo Settings → Actions → General → Workflow permissions →
  "Read and write permissions".
- **Cause 3**: the `release` job exited early because `verify` failed.
  Check the job log.

## `release-watcher.yml` did not update `.gitmap/release/latest.json`

- **Cause**: the watcher triggers on `release: published`, not on tag
  push. Draft releases are ignored.
- **Fix**: publish the draft release manually, or run
  `audit-releases.yml` (workflow dispatch) which will reconcile every
  release into `.gitmap/release/`.

## Extension zip is bigger than expected

- **Cause 1**: a `*.map` file leaked in. The `verify` step should catch
  this, but if it does not, inspect the zip:
  `unzip -l public/inspect-page.zip | grep '.map$'`
- **Cause 2**: `bundle-report.html` was generated. The visualizer is
  gated behind `ANALYZE=1` — make sure CI does not set it.
- **Cause 3**: a new dependency was added without tree-shaking. Run
  `ANALYZE=1 cd extension && bun run build` locally and inspect
  `bundle-report.html`.

## "Bun lockfile out of date" on CI

- **Cause**: `bun.lock` not committed after a `bun add` / `bun remove`.
- **Fix**: locally run `bun install` (no `--frozen-lockfile`), commit
  the updated `bun.lock`, push.

## Extension build green locally but red on CI

- Almost always a path-case mismatch (macOS/Windows case-insensitive;
  Linux case-sensitive). Check imports for capitalization drift.
- Second most common: a missing file under `extension-src/` that exists
  locally but was never staged. Run `git status` before pushing.

## WP plugin zip fails to install on WordPress

- **Cause 1**: zip contains a top-level directory other than
  `inspect-page/`. The packager always creates `inspect-page/` as the
  root — verify with `unzip -l public/inspect-page-wp.zip`.
- **Cause 2**: `inspect-page.php` plugin header version does not match
  `INSPECT_PAGE_VERSION`. WP shows "Update Required" forever.
  `check-wp-version-sync.mjs` catches this before release.
- **Cause 3**: `Requires PHP: 7.4` / `Requires at least: 5.6` raised
  without testing. Roll back the header values.

## Stuck in an error loop?

1. Diagnose the signal — read the job log, do not guess.
2. Reproduce locally with the exact same command.
3. If reproduced: fix the code. If not: it is environmental — compare
   Bun / Node / OS / cache state.
4. Avoid more than three speculative attempts; if stuck, open
   `pipeline/` issue or ask for a human review.