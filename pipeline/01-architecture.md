# 01 — Project Architecture

## Repository Layout

```
repo-root/
├── src/                                 # Marketing site (Lovable React/Vite)
├── extension-src/                       # Chrome extension TypeScript source
│   ├── manifest.json                    # MV3 manifest (carries extension version)
│   ├── background.ts                    # Service worker entry
│   ├── content.ts                       # Content script entry
│   ├── panel/                           # Popup + floating panel UI (React)
│   ├── picker/                          # Element-pick overlay
│   ├── share/                           # Smart Share REST clients
│   └── shared/                          # Cross-context types/utilities
├── extension/                           # Extension build root
│   ├── package.json                     # name=inspect-page, carries extension version
│   ├── vite.config.ts                   # Multi-entry Vite build
│   ├── dist/                            # Build output (gitignored)
│   └── scripts/package.sh               # Zips dist/extension into public/inspect-page.zip
├── wp-plugin/inspect-page/              # WordPress plugin source
│   ├── inspect-page.php                 # Plugin header (carries WP plugin version) + INSPECT_PAGE_VERSION constant
│   ├── readme.txt                       # WordPress.org-style readme (Stable tag = version)
│   ├── includes/                        # PHP classes (REST routes, billing, sessions)
│   ├── mu-plugin/                       # Optional MU loader
│   └── tests/                           # PHP unit tests (PHPUnit-light)
├── scripts/                             # Repo-level build & release scripts
│   ├── release.sh                       # Build extension + repackage both zips
│   ├── package-wp.sh                    # Zips wp-plugin/inspect-page → public/inspect-page-wp.zip
│   ├── ci/                              # CI validators (see 04-validation-scripts.md)
│   └── … (launch-orchestrator, smoke, rollback, post-launch-watch)
├── public/                              # Static assets served by the marketing site
│   ├── inspect-page.zip                 # Latest extension build
│   ├── inspect-page.zip.sha256
│   ├── inspect-page-wp.zip              # Latest WP plugin build
│   └── inspect-page-wp.zip.sha256
├── .github/workflows/                   # GitHub Actions
├── .gitmap/release/                     # Per-release JSON manifests + latest.json
├── pipeline/                            # This folder (AI-portable docs)
├── security-notes/                      # Supply-chain + REST contract pins
├── docs/PROJECT-DOCS.md                 # Single source of product truth (do not split)
└── package.json                         # Root — marketing site + shared dev deps
```

## Dependency Graph (Build Order)

```
root install (bun)
   │
   ├──► marketing site build  (vite build, src/ → dist/)
   │
   ├──► extension install (bun, extension/)
   │       │
   │       └──► vite build  (extension-src/ → extension/dist/extension/)
   │              │
   │              └──► scripts/package.sh
   │                     → public/inspect-page.zip + .sha256
   │
   └──► scripts/package-wp.sh
           (wp-plugin/inspect-page/ → public/inspect-page-wp.zip + .sha256)
```

**Rule:** the extension and the WP plugin are independent. Either can be
released without rebuilding the other. The marketing site only embeds
links to the two zips — it does not contain them.

## Key Concepts

### Dual artifacts, dual versions

The Chrome extension and the WordPress plugin ship on their own cadence
with their own version numbers. CI builds both on every push; release
workflows only fire when the right branch / tag pattern matches.

| Artifact         | Branch trigger        | Tag trigger | Release asset            |
|------------------|-----------------------|-------------|--------------------------|
| Chrome extension | `release/ext-vX.Y.Z`  | `ext-vX.Y.Z`| `inspect-page.zip` + `.sha256` |
| WordPress plugin | `release/wp-vX.Y.Z`   | `wp-vX.Y.Z` | `inspect-page-wp.zip` + `.sha256` |

### Zip + sha256 contract

Every release uploads the zip **and** its `sha256` digest. The
`check-zip-freshness.mjs` validator (see `04-validation-scripts.md`)
ensures the checked-in `.sha256` file matches the byte content of its
sibling zip on every CI run — preventing stale-zip drift.

### Brand-name guard

The product is always written as `Inspect Page` (two words, capital `I`
+ `P`). The strings `PagePort`, `LLM Export`, `LLM Page Export`, and
`llm-export` are **banned** repo-wide. `check-brand-name.mjs` fails CI
if any banned token appears in source, docs, fixture names, or zip
contents.

## Technology Stack

| Layer             | Technology |
|-------------------|------------|
| Language          | TypeScript 5 (extension + marketing), PHP 7.4+ (WP plugin) |
| Bundler           | Vite 5 |
| Package manager   | Bun 1.x (extension + marketing); Composer is not used |
| Runtime           | Node.js 20 (for CI validators) |
| Test framework    | Vitest (TS), lightweight PHPUnit harness (`wp-plugin/inspect-page/tests/`) |
| Linter            | ESLint 9 (flat config) |
| CI platform       | GitHub Actions |
| CSS (extension)   | Plain CSS (theme tokens locked — see memory) |
| CSS (marketing)   | Tailwind CSS v3 |
| WP minimum        | WordPress 5.6, PHP 7.4 |