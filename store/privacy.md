# PagePort — Privacy Policy

_Last updated: 2026-05-10_

PagePort is a Chrome extension that captures the page in the active
tab into a downloadable bundle. This policy describes what data the
extension touches and what it does (and does not) do with it.

## Summary

- PagePort runs entirely on your machine.
- We do not operate any server. We do not collect telemetry, analytics,
  crash reports, or usage statistics.
- We do not sell, share, or transfer any data.
- The only network requests the extension itself initiates are
  (a) fetching stylesheets and scripts the page you are exporting
  already references, and (b) — only if you explicitly configure
  Share Links — a single upload to the WordPress site you point it at.

## Data we touch

| Data | Stored where | Lifetime | Sent anywhere? |
|---|---|---|---|
| Your settings (export preferences, redaction toggle, naming template) | `chrome.storage.local` on your device | Until you uninstall or reset | No |
| Floating-panel position | `chrome.storage.local` on your device | Same as above | No |
| WordPress credentials (only if you enable Share Links) | `chrome.storage.local` on your device | Until you remove them | Only sent, over HTTPS, to the site URL you entered, with `Basic` Application-Password auth |
| Page HTML / CSS / JS being exported | RAM during the export | Released when the export finishes or fails | Saved only to your local Downloads folder, unless you choose Share Links |
| Screenshot pixels | RAM (`OffscreenCanvas`) during the export | Released after the file is saved | Saved only to your local Downloads folder, unless you choose Share Links |
| Logs | Browser DevTools console | Per browsing context | Never sent |

## Permissions and why

PagePort requests the minimum permissions needed to do its job. The
exact list and the per-permission justification is in
[`permissions.md`](./permissions.md) and on the Chrome Web Store
listing. Notably we do **not** request `cookies`, `history`,
`bookmarks`, `topSites`, `webRequest`, or `debugger`.

## Password and secret redaction

Password redaction is on by default. Before any export is written to
disk, every `<input type="password">` in the captured HTML is
serialized with an empty `value` and a `data-redacted="true"` marker.
You can disable this in Settings if you have a specific need; we
recommend leaving it on.

We do not attempt to detect other secret-shaped fields (autofill
credit cards, OTPs, JWTs in localStorage, etc.). Always review your
export before sharing it.

## Smart Share (optional WordPress backend)

If you install the companion WordPress plugin and enter your site URL
in PagePort's Settings, the Smart Share export mode will:

1. Sign you in by opening your WordPress site's standard login page in
   a hidden tab; PagePort never sees or stores your password. Your
   browser's existing WP login cookie is what authenticates the upload.
2. POST the captured HTML, CSS, JavaScript, and screenshot over HTTPS
   to `https://your-site/wp-json/pageport/v1/sessions`, authenticated
   with that WP login cookie plus a short-lived `X-WP-Nonce`.
3. Receive four short public URLs back (one each for `index.html`,
   `style.css`, `script.js`, `preview.png`), valid for 24 hours.
4. Copy an instruction block containing those URLs to your clipboard.

After 24 hours an hourly cron job on your WordPress site deletes the
files and marks the session expired. You can revoke any session
earlier from **Tools → PagePort Sessions** in WordPress admin. We do
not operate the WordPress site — you do.

## Children

PagePort is not directed at children under 13. It does not knowingly
collect data from anyone.

## Changes

If we change this policy we will update the "Last updated" date and
publish the new version at the same URL. Substantive changes will be
called out in the extension's "What's new" section.

## Contact

Open an issue at https://github.com/pageport/pageport (or the
repository linked from the Chrome Web Store listing).