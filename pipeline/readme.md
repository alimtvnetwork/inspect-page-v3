# CI/CD Pipeline — Implementation Guide

> **Purpose**: this folder documents the full CI/CD pipeline for the
> **Inspect Page** project. It is written to be **AI-portable** — any AI
> coding assistant should be able to read these files and reproduce,
> extend, or debug the pipeline without prior context.
>
> The blueprint is modeled on `alimtvnetwork/macro-ahk-v34/pipeline/`.

## Quick Overview

Inspect Page ships three independently-versioned artifacts from a single
repo:

| Artifact                  | Source                                | Output                              | Version anchor |
|---------------------------|---------------------------------------|-------------------------------------|----------------|
| Chrome extension          | `extension-src/` + `extension/`       | `public/inspect-page.zip`           | `extension/package.json` + `extension-src/manifest.json` |
| WordPress plugin          | `wp-plugin/inspect-page/`             | `public/inspect-page-wp.zip`        | `wp-plugin/inspect-page/inspect-page.php` header + `INSPECT_PAGE_VERSION` |
| Marketing site (Lovable)  | `src/`                                | `dist/` (served by Lovable)         | `package.json` (root) |

The pipeline has **two primary workflows**:

1. **CI** — `.github/workflows/ci.yml` runs on every push to `main` and on
   pull requests. Lint → test → build all three artifacts → verify.
2. **Release** — `.github/workflows/release.yml` runs on
   `release/ext-*` / `release/wp-*` branches and on `ext-v*` / `wp-v*`
   tags. Same pipeline + packaging + GitHub Release upload.

Four supporting workflows: `release-watcher.yml`, `audit-releases.yml`,
`installer-tests.yml`, `quality-badges.yml`.

## Files in This Folder

| File | What it covers |
|------|----------------|
| [`01-architecture.md`](01-architecture.md) | Project structure, build artifacts, dependency graph |
| [`02-ci-workflow.md`](02-ci-workflow.md) | CI pipeline: triggers, jobs, concurrency, caching |
| [`03-release-workflow.md`](03-release-workflow.md) | Release pipeline: branches, tags, packaging, GitHub Release |
| [`04-validation-scripts.md`](04-validation-scripts.md) | Pre-build checks (version sync, brand-name guard, zip freshness) |
| [`05-build-chain.md`](05-build-chain.md) | Build order, per-artifact command chain |
| [`06-versioning.md`](06-versioning.md) | Dual versioning (extension vs WP plugin), bump process |
| [`07-extending.md`](07-extending.md) | How to add a new asset / validator / workflow |
| [`08-troubleshooting.md`](08-troubleshooting.md) | Common failures and fixes |

## Companion folders

- [`.gitmap/release/`](../.gitmap/release/) — per-release JSON manifests, the canonical record of every published release. `latest.json` points at the most recent shipped version of each artifact.
- [`scripts/ci/`](../scripts/ci/) — validation Node + bash scripts the workflows call.
- [`security-notes/`](../security-notes/) — supply-chain pins and security contracts (axios, WP REST namespace).