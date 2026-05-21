---
name: CI/CD pipeline
description: Doc-first AI-portable pipeline modeled on macro-ahk-v34. Locations of validators, workflows, registry, and security pins.
type: feature
---
Doc-first CI/CD wired 2026-05-21 (mirrors macro-ahk-v34 reference repo).

**Locations (single-source-of-truth = `pipeline/readme.md`):**
- `pipeline/` — 9 md docs (architecture, ci, release, validators, build chain, versioning, extending, troubleshooting).
- `scripts/ci/` — 5 Node validators: `check-brand-name.mjs` (allows lines tagged "legacy"), `check-version-sync.mjs`, `check-wp-version-sync.mjs`, `check-zip-freshness.mjs`, `check-axios-version.mjs` (>=1.7.4, no-op if absent).
- `.github/workflows/` — `ci.yml` (setup→validate∥lint-test→build-site∥build-extension∥package-wp→verify), `release.yml` (tags `ext-v*`/`wp-v*`), `release-watcher.yml` (refreshes `.gitmap/release/` on Release publish), `audit-releases.yml` (weekly cron), `installer-tests.yml`, `quality-badges.yml`. Legacy `extension-ci.yml` kept.
- `.gitmap/release/` — `latest.json` + `<tag>.json` per release. Seed entries marked `"_seed": true`, overwritten by watcher.
- `security-notes/axios-pin.md` + `wp-plugin-pin.md` — supply-chain floors.

**Release flow:** bump version → `bash scripts/release.sh` or `scripts/package-wp.sh` → all `scripts/ci/check-*.mjs` pass → push `ext-vX.Y.Z` or `wp-vX.Y.Z` tag → `release.yml` builds + publishes → watcher updates registry → append to `docs/PROJECT-DOCS.md` §9.

**Known drift to fix:** WP plugin header is `2.5.5` on disk while memory + registry seed expect `2.6.0`. `check-wp-version-sync.mjs` currently passes against 2.5.5; bump header + constant when ready.
