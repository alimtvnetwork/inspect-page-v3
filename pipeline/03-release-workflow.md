# 03 — Release Workflow

**File**: `.github/workflows/release.yml`
**Triggers** (any of these produces a Release with the full asset set):
- push tag `ext-vX.Y.Z` or `wp-vX.Y.Z`
- push branch `release/ext-vX.Y.Z` or `release/wp-vX.Y.Z`
- GitHub `release` event (REST API / `gh` CLI / web UI — `published`, `created`, `edited`, `released`) — catches releases created via API that do not fire push/create webhooks
- `workflow_dispatch` with `version` (+ optional `source_ref`) — manual replay/recovery
- `workflow_call` with same inputs — used by `release-watcher.yml`

**Concurrency**: never cancelled — every release commit must produce a
GitHub Release (`cancel-in-progress: false`).

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

Release assets carry the version in the filename (matching the macro-ahk-v34
convention) so users can identify what they downloaded:

| Target | Assets attached to the Release |
|--------|--------------------------------|
| ext    | `inspect-page-vX.Y.Z.zip`, `install.sh`, `install.ps1`, `VERSION.txt`, `changelog.md`, `checksums.txt` |
| wp     | `inspect-page-wp-vX.Y.Z.zip`, `VERSION.txt`, `changelog.md`, `checksums.txt` |

The marketing site still serves the stable filenames `public/inspect-page.zip`
and `public/inspect-page-wp.zip` from the repo root for the landing-page
download buttons; those are the source files the workflow copies and renames
into the versioned release assets.

## Latest Badge

Only `ext-v*` non-prerelease tags receive GitHub's green **"Latest"** badge
(`make_latest: true`). `wp-v*` releases never claim it. Rationale: the
extension is the user-facing product; the WP plugin is a supporting backend.

## Installers (extension only)

`scripts/install.{sh,ps1}` are committed to `main` (for the "latest channel"
one-liner) and also attached to every `ext-v*` release (for version-pinned
one-liners). Both scripts:

1. Auto-derive `REPO` + `VERSION` from their own download URL (parent
   process command line on Bash, `$PSCommandPath` / parent CIM on PS).
2. Fall back to the GitHub API for "latest ext-v\*" when run from `main`.
3. Download `inspect-page-vX.Y.Z.zip`, verify SHA256 against
   `checksums.txt`, extract to `~/inspect-page-<X.Y.Z>/`, and maintain a
   stable `~/inspect-page` symlink so Chrome's "Load unpacked" path
   survives upgrades.
4. Print "Load unpacked" instructions on success.

Env overrides: `IP_REPO`, `IP_VERSION`, `IP_DEST`.

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