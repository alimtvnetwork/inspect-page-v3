# 05 — Build Chain

Every artifact has an explicit, deterministic command chain. Workflows
invoke these chains; no step is implicit.

## Chrome extension

```
# 1. Install
cd extension && bun install --frozen-lockfile

# 2. Build (three entry points: popup, background, content)
bun run build
#   ↳ vite build (popup)
#   ↳ vite build (background.ts as IIFE)
#   ↳ vite build (content.ts as IIFE)
#   ↳ vite build (manifest.json + assets)

# 3. Package
bash extension/scripts/package.sh
#   ↳ zips extension/dist/extension/ → public/inspect-page.zip
#   ↳ deletes any *.map files first (safety net)

# 4. Checksum
sha256sum public/inspect-page.zip > public/inspect-page.zip.sha256
```

The single-shot equivalent is `bash scripts/release.sh`, which runs the
extension build, packages both zips, and prints both checksums.

## WordPress plugin

```
# 1. (No install step — pure PHP, no Composer)

# 2. Package
bash scripts/package-wp.sh
#   ↳ rsyncs wp-plugin/inspect-page/ → /tmp/build/inspect-page/
#     (excludes tests/, .git, *.md, node_modules, .DS_Store)
#   ↳ zips → public/inspect-page-wp.zip

# 3. Checksum
sha256sum public/inspect-page-wp.zip > public/inspect-page-wp.zip.sha256
```

## Marketing site

```
bun install --frozen-lockfile
bun run build           # vite build, root → dist/
```

Lovable serves `dist/` automatically — no zip, no checksum.

## Vitest

```
cd extension && bun run test     # vitest run (single pass, 212 tests as of v2.7.5)
```

Tests run inside the `extension/` workspace because that is where
`vitest.config.ts` lives and where `extension-src/` is resolved by the
`@shared`, `@element`, `@panel` path aliases.

## Release-time chain

```
release.yml::setup
    ├── lint (root)
    ├── lint (extension)
    └── test (extension)

release.yml::build-<target>
    ├── target=ext → Chrome extension chain (above)
    └── target=wp  → WordPress plugin chain (above)

release.yml::release
    ├── verify (brand-name, version-sync, zip-freshness)
    ├── GitHub Release create
    └── upload zip + .sha256
```