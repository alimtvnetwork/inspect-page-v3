# 02 — CI Workflow

**File**: `.github/workflows/ci.yml`
**Triggers**: push to `main`, pull requests to `main`
**Concurrency**: cancel previous in-flight builds when a new commit lands

## Pipeline Architecture

CI is structured as **5 jobs** with dependency edges:

```
┌─────────┐
│  setup  │  ← checkout, bun install, lint, vitest
└────┬────┘
     │
     ├──────────────────┬──────────────────────┐
     │                  │                      │
┌────▼───────────┐ ┌────▼──────────┐ ┌────────▼────────┐
│ build-extension│ │  package-wp   │ │   build-site    │
└────┬───────────┘ └────┬──────────┘ └────────┬────────┘
     │                  │                      │
     └──────────────────┴──────────────────────┘
                       │
                  ┌────▼────┐
                  │ verify  │  ← brand-name, version-sync, zip-sha256
                  └─────────┘
```

## Job Descriptions

### 1. `setup` — Lint + Test

Runs all quality gates before any build work begins.

| Step                | Command                                        | Purpose                            |
|---------------------|------------------------------------------------|------------------------------------|
| Checkout            | `actions/checkout@v4 (fetch-depth: 1)`         | Shallow clone                      |
| Setup Bun           | `oven-sh/setup-bun@v2 (bun-version: 1.x)`      | Runtime                            |
| Setup Node          | `actions/setup-node@v4 (node 20)`              | For CI validator scripts (.mjs)    |
| Cache `~/.bun/install/cache` | `actions/cache@v4` keyed on `bun.lock` | Skip downloads on rerun         |
| Cache `node_modules`         | `actions/cache@v4` keyed on `bun.lock` | Skip install on cache hit       |
| Install root deps   | `bun install --frozen-lockfile`                | Marketing + shared dev deps        |
| Install ext deps    | `cd extension && bun install --frozen-lockfile`| Extension toolchain                |
| Root lint           | `bun run lint`                                 | ESLint flat config                 |
| Tests               | `cd extension && bun run test`                 | Vitest single-pass (212 tests)     |

### 2. `build-extension`

**Depends on**: `setup`
**Uploads**: `public/inspect-page.zip` + `.sha256` as `extension-zip` artifact

Command chain:

```
cd extension && bun run build       # vite build → extension/dist/extension/
bash extension/scripts/package.sh   # → public/inspect-page.zip
sha256sum public/inspect-page.zip > public/inspect-page.zip.sha256
```

### 3. `package-wp`

**Depends on**: `setup`
**Uploads**: `public/inspect-page-wp.zip` + `.sha256` as `wp-zip` artifact

Command chain:

```
bash scripts/package-wp.sh          # → public/inspect-page-wp.zip
sha256sum public/inspect-page-wp.zip > public/inspect-page-wp.zip.sha256
```

### 4. `build-site`

**Depends on**: `setup`
**Uploads**: `dist/` as `marketing-site` artifact (retention 1 day)

Command: `bun run build`

### 5. `verify`

**Depends on**: `build-extension`, `package-wp`, `build-site`
**Downloads**: both zip artifacts

Runs the four validators (see `04-validation-scripts.md`):

```
node scripts/ci/check-brand-name.mjs
node scripts/ci/check-version-sync.mjs
node scripts/ci/check-wp-version-sync.mjs
node scripts/ci/check-zip-freshness.mjs
```

## Concurrency Strategy

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

A new push to a branch / PR cancels any in-progress CI run on that ref.
`main` and release branches each get their own group.

## Cache Strategy

Every job that runs `bun install` caches both `~/.bun/install/cache` and
`node_modules` keyed on `bun.lock`. Cached reruns install in seconds
instead of minutes. Each job uses a unique cache key prefix (`bun-setup-`,
`bun-ext-`) so parallel jobs do not race on the same key.

## Artifact Passing Between Jobs

| Artifact name     | Source path                          | Consumed by |
|-------------------|--------------------------------------|-------------|
| `extension-zip`   | `public/inspect-page.zip` + `.sha256`| `verify`    |
| `wp-zip`          | `public/inspect-page-wp.zip` + `.sha256` | `verify` |
| `marketing-site`  | `dist/`                              | release-only (CI ignores) |

Retention is **1 day** — these are ephemeral build intermediates only.
Release assets get their own permanent upload in `release.yml`.