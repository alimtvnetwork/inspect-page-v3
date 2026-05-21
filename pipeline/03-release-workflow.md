# 03 — Release Workflow

**File**: `.github/workflows/release.yml`
**Triggers**:
- push to `release/ext-vX.Y.Z` branches **or** `ext-vX.Y.Z` tags → Chrome extension release
- push to `release/wp-vX.Y.Z` branches **or** `wp-vX.Y.Z` tags → WP plugin release

**Concurrency**: never cancelled — every release commit must produce a
GitHub Release.

## Pipeline Architecture

The release pipeline mirrors CI plus a packaging + publish job. The
`target` is resolved from the ref pattern (`ext` or `wp`) and only the
matching artifact is built and uploaded.

```
┌─────────┐
│  setup  │  ← checkout (depth 0), resolve target + version, lint, test
└────┬────┘
     │
     ├──────────────────┐
     │                  │
┌────▼────────────┐ ┌───▼───────────┐
│ build-extension │ │  package-wp   │   (only the matching job runs)
└────┬────────────┘ └───┬───────────┘
     │                  │
     └────────┬─────────┘
              │
         ┌────▼─────┐
         │ release  │  ← verify, upload assets, create GitHub Release
         └──────────┘
```

## Ref Pattern → Target Resolution

| Trigger ref                       | `target` output | Build job        | Upload assets                                 |
|-----------------------------------|-----------------|------------------|-----------------------------------------------|
| `refs/tags/ext-v2.7.6`            | `ext`           | `build-extension`| `inspect-page.zip` + `inspect-page.zip.sha256`|
| `refs/heads/release/ext-v2.7.6`   | `ext`           | `build-extension`| same                                          |
| `refs/tags/wp-v2.6.1`             | `wp`            | `package-wp`     | `inspect-page-wp.zip` + `inspect-page-wp.zip.sha256` |
| `refs/heads/release/wp-v2.6.1`    | `wp`            | `package-wp`     | same                                          |

`version` is extracted with `${REF##*v}` (everything after the final `v`).

## Job Descriptions

### 1. `setup`

| Step               | Command                                |
|--------------------|----------------------------------------|
| Checkout           | `actions/checkout@v4 (fetch-depth: 0)` |
| Resolve target     | Bash regex on `$GITHUB_REF`            |
| Resolve version    | `${REF##*v}`                           |
| Setup Bun + Node   | as in CI                               |
| Install + lint     | as in CI                               |
| Tests              | `cd extension && bun run test`         |
| Version cross-check| target=ext → `check-version-sync.mjs --expect "$VERSION"`; target=wp → `check-wp-version-sync.mjs --expect "$VERSION"` |

Outputs `target`, `version` for downstream jobs.

### 2. `build-extension` (when target=ext) / `package-wp` (when target=wp)

Identical to CI but additionally renames the produced zip's internal
folder to match the release version, and refreshes the sibling `.sha256`.

### 3. `release`

- Downloads the matching zip artifact.
- Runs `check-zip-freshness.mjs` on the downloaded files.
- Creates a GitHub Release via `softprops/action-gh-release@v2`:
  - Tag name = `${target}-v${version}` (created if missing).
  - Release title = `Inspect Page ${target.upper()} v${version}`.
  - Body = the matching section from `docs/PROJECT-DOCS.md §9`.
  - Assets = the zip + the `.sha256` file.

## Asset Naming

Release assets keep stable, predictable filenames so the marketing site's
download buttons never break:

| Target | Asset                          |
|--------|--------------------------------|
| ext    | `inspect-page.zip`             |
| ext    | `inspect-page.zip.sha256`      |
| wp     | `inspect-page-wp.zip`          |
| wp     | `inspect-page-wp.zip.sha256`   |

The version is encoded in the **tag and release title**, not in the
filename. This is intentional: the marketing site always serves "latest".

## Post-Release Side-Effects

After the GitHub Release is created, `release-watcher.yml` (see
`07-extending.md`) fires automatically and writes
`.gitmap/release/${target}-v${version}.json` plus updates
`.gitmap/release/latest.json`.

## Source Map Policy

Source maps are **never shipped in release assets**:

1. `extension/vite.config.ts` sets `sourcemap: false` in production mode.
2. `verify` job greps the unpacked zip for `*.map` and **fails** if any
   are present.
3. `extension/scripts/package.sh` deletes stray `*.map` files as a
   safety net before zipping.