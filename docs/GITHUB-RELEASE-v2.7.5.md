# Inspect Page v2.7.5

> GitHub-style release notes for the Inspect Page Chrome extension + WordPress plugin.
> Mirror this as the body of the `ext-v2.7.5` / `wp-v2.6.0` GitHub Release.

### Release Info

| Field | Value |
| --- | --- |
| Extension Version | `v2.7.5` |
| WP Plugin Version | `v2.6.0` |
| Branch | `release/v2.7.5` |
| Build Date | 2026-05-21 04:32:00 UTC |
| Channel | Stable |

### What's Changed

#### New Features — Color Tokens v2

- **Dark-Calendar token palette**: every detected color is emitted as `--ip-color-N` with `tint` (+12% L), `base`, and `shade` (-12% L) variants.
- **New MD blocks** in every export: `## Color tokens`, `## Variants`, `## Selector map`.
- **New files** in MD+files and ZIP exports: `tokens.css` and `selectors.css`.
- **Smart Share parity**: the same token CSS is baked into shared payloads via `withAddonsBakedIn` in `panel/ExportModes.tsx`.
- **Inspect → Colors → Tokens** sub-tab: rename tokens and attach per-selector custom CSS, persisted in `chrome.storage.local` under `inspect-page:color-tokens:<fnv32>`.

#### Carry-overs (still shipping)

- v2.7.4 — packaged required MV3 offscreen capture files (`offscreen.html` + `offscreen.js`); Export Full Page no longer fails at `phase=captureFullPage`.
- v2.7.3 — removed all host gatekeeping for Export Full Page; works on any `http(s)://` URL.
- v2.7.2 — multi-element picker (up to 11 elements) with per-element MD/ZIP/Smart Share sections.
- v2.7.0 — Team Workspaces (roles, invites, Stripe-per-workspace billing).

#### Quality

- 212 / 212 vitest passing.
- 68 / 68 PHP assertions passing on the WordPress plugin.

---

### Checksums (SHA256)

```
e76871f3223f782a7530a2d61c4235a5d9a5eb54435d3be837241062691c5f55  inspect-page.zip
d5394419cc287a6bf2e90c9bacfc6b1d0d5e19fb35d408dd47fe9eeea0145203  inspect-page-wp.zip
```

### Assets

| Asset | Description |
| --- | --- |
| `inspect-page.zip` | Chrome extension (MV3) — load unpacked in `chrome://extensions` |
| `inspect-page-wp.zip` | WordPress plugin — upload via WP Admin → Plugins → Add New → Upload |
| `inspect-page.zip.sha256` | SHA256 checksum for the extension bundle |
| `inspect-page-wp.zip.sha256` | SHA256 checksum for the WP plugin bundle |
| `RELEASE-NOTES-v2.7.5.md` | Full changelog for this release |
| `LIVE-MODE-RUNBOOK-v2.7.0.md` | Operator runbook (still current) |

### Quick Install

#### Chrome Extension (manual, unpacked)

1. Download `inspect-page.zip` from this release.
2. Extract it to a local folder.
3. Open `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the extracted folder.

Works in any Chromium browser: Chrome, Edge, Brave, Arc, Opera.

#### WordPress Plugin

1. Download `inspect-page-wp.zip` from this release.
2. In WP Admin go to **Plugins → Add New → Upload Plugin**.
3. Choose `inspect-page-wp.zip`, click **Install Now**, then **Activate**.
4. Open **Inspect Page** in the WP admin sidebar to pair the extension.

#### Verify checksums

**Linux / macOS:**

```
shasum -a 256 -c inspect-page.zip.sha256
shasum -a 256 -c inspect-page-wp.zip.sha256
```

**Windows (PowerShell):**

```
Get-FileHash inspect-page.zip    -Algorithm SHA256
Get-FileHash inspect-page-wp.zip -Algorithm SHA256
```

### Upgrade Notes

- Existing Smart Share links continue to work; no DB migration required for v2.7.5.
- WP plugin auto-runs schema upgrade on `plugins_loaded` when the file version is newer than the stored `inspect_page_db_version`.
- No breaking changes to REST routes under `inspect-page/v1`.

### Known Issues

- Production `INSPECT_PAGE_WP_SITE_URL` constant still ships empty in this build — set it before publishing to the Chrome Web Store.
- Stripe live keys + webhook secret must be configured in WP Admin → Inspect Page → Billing for paid plans to flip licenses.

---

_All reactions welcome — file issues with extension version, WP plugin version, Chrome version, and the failing site URL._