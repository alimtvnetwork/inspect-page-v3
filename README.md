<div align="center">

# Inspect Page

> **Export any web page (or one element) — HTML, CSS, JavaScript, color tokens, fonts, and a full-page screenshot — bundled into one artifact your LLM can actually work with.**

Chrome Manifest V3 extension + companion WordPress plugin for Smart Share, billing, and analytics.

[![CI](https://img.shields.io/badge/CI-passing-2DD4A8?style=flat-square&logo=github)](.github/workflows/ci.yml)
[![Extension](https://img.shields.io/badge/extension-v2.7.7-2DD4A8?style=flat-square&logo=googlechrome)](public/inspect-page.zip)
[![WP Plugin](https://img.shields.io/badge/wp--plugin-v2.6.0-21759b?style=flat-square&logo=wordpress)](public/inspect-page-wp.zip)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-4285F4?style=flat-square&logo=googlechrome)](extension-src/manifest.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#license)

</div>

---

## Install

### Chrome Extension

#### Option 1 — One-line installer (latest, auto-updates)

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.ps1 -UseBasicParsing | iex
```

The script downloads the latest release zip, verifies its SHA256, extracts to `~/inspect-page-<version>/`, and maintains a stable `~/inspect-page` symlink so you never need to re-point Chrome's "Load unpacked" path after upgrades.

#### Option 2 — Pinned to a specific version

Every GitHub Release ships `install.sh` + `install.ps1` as assets. Curl them from the release URL and the script pins itself to that version automatically:

```bash
curl -fsSL https://github.com/<owner>/<repo>/releases/download/ext-v2.7.7/install.sh | bash
```

#### Option 3 — Manual (Load Unpacked)

1. Download [`public/inspect-page.zip`](public/inspect-page.zip) and unzip it.
2. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave, Arc, Opera).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.

Installer env overrides: `IP_REPO=owner/repo`, `IP_VERSION=ext-v2.7.7`, `IP_DEST=/path` (PowerShell: `$env:IP_REPO`, etc.).

---

## About Inspect Page

Inspect Page started from one frustrating loop: paste a screenshot into an LLM, then re-paste the HTML, then the CSS, then a missing font, then realize the colors are off because the screenshot was compressed. Every "look at this page and help me redesign it" prompt was a chore.

So the extension does that whole bundle in one click. It captures the rendered page (or a single element), extracts the HTML, the cascaded CSS, the inline JS, the actual color tokens (tint/base/shade), the fonts that were really used, and a full-page screenshot — then hands the LLM a single Markdown file (or a zip, or four short shareable URLs) with everything in the right place and a ready-to-paste AI instruction block on top.

It is Manifest V3, dark-mint themed, and the in-page floating panel is pinned to a stable 412×820 visual size on every site and every Chrome zoom level.

---

## Features (in detail)

### Capture modes

- **Full Page** — entire document, stitched screenshot, full DOM + CSSOM.
- **Element** — click a single element in the floating inspector; the export bundles just that subtree and its computed styles.
- **Inspect tab** — live snapshot of the current page: tag counts, colors, fonts, computed metrics. Refresh with ↻.

### Export modes

| Mode | Output | Best for |
|---|---|---|
| **MD single** | One `.md` file with a base64-inlined screenshot. | Drag into ChatGPT / Claude in one drop. |
| **MD + files** | `.zip` containing `prompt.md` plus assets as separate files. | LLM tools that prefer real files over base64. |
| **ZIP** | Full bundle with `prompt.md`, `index.html`, `style.css`, `script.js`, `tokens.css`, `selectors.css`, `preview.png`. | Local archival, handoff to a designer. |
| **Smart Share** *(Pro / WP plugin)* | Uploads to the user's own WordPress site and returns 4 short public URLs valid for 24h, plus the AI instruction block. | Pasting into a chat window without attachments. |

From the Inspect tab, the **Export report** dropdown can also emit standalone artifacts via real Chrome downloads with a Save As prompt: JSON snapshot, Markdown report, Colors CSV, Fonts CSV.

### Color Tokens v2

Each detected color is broken into **tint / base / shade** variants and written to `tokens.css`. Per-selector custom CSS rules are emitted to `selectors.css` so the LLM sees both the design system *and* where it was applied.

### Smart Share auth

Standard WordPress login cookie + `X-WP-Nonce`. **No** pairing tokens, **no** Application Passwords. Sign-in opens the hidden `inspect-page-bridge` admin page and the bridge sends a `wp_rest` nonce back to the extension via `postMessage`.

Per-WP-user limits: **30** active sessions, **60** uploads/hour, lifetime free quota of **5** Smart Shares. Beyond that the popup shows an inline **Upgrade to Pro** CTA that opens Stripe Checkout. Pro users get unlimited shares and the "Manage subscription" button (Stripe Customer Portal). The popup tagline ("$X / month") is rendered dynamically from Stripe via the WP `/billing/status` endpoint (cached 12h).

### WP plugin dashboard

- **Account** — license status, email, plan.
- **Pairing** — extension health, REST + permalinks check.
- **Live quotas** — uploads/hour, active sessions, lifetime shares used.
- **Tools → Sessions** — sortable list with JS column, expiry countdown, and a "Recent visitors" drawer (Pro, opt-in).

### Popup & floating panel UX

- **Settings** opens as a full popup overlay (no peeking export UI behind it) with a native-styled dark `<select>` chevron.
- **Inspect** tab paints a shimmer skeleton on first frame, then fills in the snapshot asynchronously via `requestIdleCallback`. Subsequent opens paint instantly from a module-scoped cache.
- **Recent Shares** rows show a 36×36 preview thumbnail and a `👁 N` badge that expands to a per-file breakdown + last-viewed timestamp.
- **In-page floating panel** is locked to a 412×820 visual size on every site and every Chrome zoom level via `chrome.tabs.getZoom` compensation.
- **Theme** is dark-mint (`#0B0F0E` / `#2DD4A8` → `#73FFB8`) across both popup and floating panel.

---

## Repository layout

```
.
├── extension/                      # Extension build root (Vite + Bun)
│   ├── extension-src/              # MV3 source (linked into extension/)
│   ├── scripts/package.sh          # Builds dist + zips → public/inspect-page.zip
│   └── vite.config.ts
│
├── extension-src/                  # Chrome MV3 source
│   ├── manifest.json               # v2.7.7
│   ├── background.ts               # MV3 service worker
│   ├── content.ts                  # Content-script entry (floating panel)
│   ├── capture/                    # Full-page + element capture pipeline
│   ├── element/                    # Element picker, DOM walker
│   ├── inspect/                    # Inspect tab: snapshot, export report
│   ├── popup/                      # React popup UI (dark-mint theme)
│   ├── offscreen.html              # Offscreen document for image stitching
│   └── icons/
│
├── wp-plugin/inspect-page/         # WordPress companion plugin (v2.6.0)
│   ├── inspect-page.php            # Plugin bootstrap
│   ├── includes/                   # REST routes, billing, quotas, bridge
│   ├── mu-plugin/                  # Must-use loader fragment
│   ├── languages/                  # i18n
│   └── tests/                      # PHPUnit
│
├── src/                            # Lovable landing site (download links, docs, privacy)
│
├── public/
│   ├── inspect-page.zip            # Built extension (Load Unpacked target)
│   ├── inspect-page.zip.sha256
│   ├── inspect-page-wp.zip         # Built WP plugin
│   └── inspect-page-wp.zip.sha256
│
├── scripts/
│   ├── release.sh                  # Build + package both artifacts
│   ├── package-wp.sh               # WP zip only
│   └── ci/                         # check-*.mjs validators (CI gate)
│
├── spec/21-app/                    # Product specs (single source of truth)
│   ├── 24-export-modes.md
│   ├── 25-share-links.md           # WP plugin layout, REST, security
│   ├── 26-implementation-order-v2.md
│   └── 11-acceptance-criteria.md
│
├── docs/PROJECT-DOCS.md            # Consolidated: capabilities, ACs, launch runbook, pen-test, release history
│
└── .github/workflows/              # CI: lint, validators, packaging
```

---

## Build & package

```bash
# Build + zip the Chrome extension → public/inspect-page.zip
cd extension && bun install --frozen-lockfile && bun run build && bun run package

# Build + zip the WP plugin → public/inspect-page-wp.zip
bash scripts/package-wp.sh

# Build both in one go
bash scripts/release.sh

# Run CI validators locally (brand, versions, zip freshness, axios)
for s in scripts/ci/check-*.mjs; do node "$s"; done
```

The `zip` CLI must be on `PATH`. CI installs it via `apt-get install -y zip` before packaging.

---

## Author

### [Md. Alim Ul Karim](https://www.google.com/search?q=alim+ul+karim)

**[Creator & Lead Architect](https://alimkarim.com)** | [Chief Software Engineer](https://www.google.com/search?q=alim+ul+karim), [Riseup Asia LLC](https://riseup-asia.com)

A system architect with **20+ years** of professional software engineering experience across enterprise, fintech, and distributed systems. His technology stack spans **.NET/C# (18+ years)**, **JavaScript (10+ years)**, **TypeScript (6+ years)**, and **Golang (4+ years)**.

Recognized as a **top 1% talent at Crossover** and one of the top software architects globally. He is also the **Chief Software Engineer of [Riseup Asia LLC](https://riseup-asia.com/)** and maintains an active presence on **[Stack Overflow](https://stackoverflow.com/users/361646/alim-ul-karim)** (2,452+ reputation, member since 2010) and **LinkedIn** (12,500+ followers).

|  |  |
|---|---|
| **Website** | [alimkarim.com](https://alimkarim.com/) · [my.alimkarim.com](https://my.alimkarim.com/) |
| **LinkedIn** | [linkedin.com/in/alimkarim](https://linkedin.com/in/alimkarim) |
| **Stack Overflow** | [stackoverflow.com/users/361646/alim-ul-karim](https://stackoverflow.com/users/361646/alim-ul-karim) |
| **Google** | [Alim Ul Karim](https://www.google.com/search?q=Alim+Ul+Karim) |
| **Role** | Chief Software Engineer, [Riseup Asia LLC](https://riseup-asia.com) |

### Riseup Asia LLC

[Top Leading Software Company in WY (2026)](https://riseup-asia.com)

|  |  |
|---|---|
| **Website** | [riseup-asia.com](https://riseup-asia.com/) |
| **Facebook** | [riseupasia.talent](https://www.facebook.com/riseupasia.talent/) |
| **LinkedIn** | [Riseup Asia](https://www.linkedin.com/company/105304484/) |
| **YouTube** | [@riseup-asia](https://www.youtube.com/@riseup-asia) |

---

## License

MIT — see [`LICENSE`](LICENSE).

<div align="center">

*README v1.0 · Extension v2.7.7 · WP Plugin v2.6.0*

</div>