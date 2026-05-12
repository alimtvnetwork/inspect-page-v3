# Permission justifications (Web Store review form)

## Single purpose statement (max 1 000 chars)

PagePort exports the web page in the active tab — its HTML, CSS,
JavaScript, and a full-page screenshot — into a downloadable bundle
suitable for pasting into a large language model. It does one thing
and one thing only: capture and export the current page or a single
element the user picks.

## Per-permission justifications

| Permission | Justification (paste verbatim) |
|---|---|
| `activeTab` | Required so PagePort can read the DOM and styles of the tab the user explicitly invoked it on. Without `activeTab` the extension cannot serialize the page the user wants to export. |
| `scripting` | Used to programmatically inject the content script and the floating panel into the active tab when the toolbar icon or keyboard shortcut is used. The injection target is always the user-initiated tab. |
| `tabs` | Needed to call `chrome.tabs.captureVisibleTab`, which is the documented Chrome API for capturing the rendered viewport. Used solely during a user-triggered export. |
| `downloads` | Required to save the resulting ZIP or Markdown file to the user's Downloads folder via `chrome.downloads.download`. The file is written locally; no upload occurs. |
| `storage` | Stores user settings (export preferences, redaction toggle, naming template) and the floating-panel position in `chrome.storage.local`. Never used for tracking. |
| `offscreen` | Chrome service workers have no DOM, so we open an offscreen document to own the `OffscreenCanvas` that stitches the full-page screenshot from the per-frame captures. |
| Host permission `<all_urls>` | The user may invoke PagePort on any HTTP(S) page they visit. The extension does not run in the background; the content script only loads when the user triggers an export on a given tab. |

## Remote code

No. The extension ships all its JavaScript inside the package. It does
not load `<script src="…">` from remote origins, does not `eval` strings
fetched at runtime, and does not download additional code. The only
remote fetches it makes are for stylesheets and scripts already
referenced by the page being exported (so they can be inlined in the
output) and, only if the user explicitly configures Smart Share, a
single multipart POST to the WordPress site URL the user entered,
authenticated by the user's existing WordPress login cookie plus a
REST nonce.

## Data usage disclosures (Web Store form checkboxes)

- [x] We do **not** collect personally identifiable information.
- [x] We do **not** collect health information.
- [x] We do **not** collect financial information.
- [x] We do **not** collect authentication information beyond what the
      user voluntarily enters into Settings (WordPress site URL) and
      WordPress login cookies set by the user's own browser when they
      sign in to their WordPress site through the standard WP login
      page. No passwords are stored by PagePort.
- [x] We do **not** collect personal communications.
- [x] We do **not** collect location.
- [x] We do **not** collect web history.
- [x] We do **not** collect user activity.
- [x] We do **not** collect website content beyond the single page the
      user explicitly exports, and that content is written only to the
      user's local Downloads folder (or, if Share Links is enabled, to
      the user's own WordPress site).
- [x] We **certify** that:
  - we do not sell or transfer user data to third parties outside of
    the approved use cases,
  - we do not use or transfer user data for purposes unrelated to the
    extension's single purpose,
  - we do not use or transfer user data to determine creditworthiness
    or for lending purposes.