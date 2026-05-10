# 25 — Share Links via WordPress plugin

Status: LOCKED for v2. Backend = a self-hosted WordPress plugin shipped alongside the extension.

## A. Why WP + Application Passwords

- Zero new infra; user already has a WP site (or installs one).
- WP 5.6+ ships **Application Passwords**: per-app revocable tokens, no OAuth flow, no token table to maintain. User generates one in `wp-admin → Users → Profile → Application Passwords`, pastes it into PagePort Settings.
- Every REST route uses `permission_callback` + `current_user_can('upload_files')` + ownership check on `user_id` column → user-scoping is automatic.

## B. Plugin layout (`wp-content/plugins/pageport/`)

```
pageport.php              # plugin header + bootstrap
includes/
  class-activator.php     # creates 4 tables on activation
  class-rest.php          # registers REST routes
  class-cleanup.php       # hourly wp-cron expiry sweep
  class-storage.php       # upload helpers (uses wp_upload_dir)
  enums.php               # PHP const-class mirrors of code enums
uninstall.php
```

Tables (all prefixed `{$wpdb->prefix}pp_`): `share_sessions`, `share_assets`, `share_session_statuses`, `share_session_kinds`, `share_asset_types`. Schema matches the user's verbatim spec, with `user_id` → WP `users.ID`. Status / Kind / AssetType seed rows on activation.

## C. REST routes (namespace `pageport/v1`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/sessions` | App Password | Create session, multipart with `html`, `css`, `image`. Returns `{ session_id, expires_at, urls: { html, css, image } }`. |
| GET | `/share/{id}/html` | public¹ | Returns `text/html`. |
| GET | `/share/{id}/css` | public¹ | Returns `text/css`. |
| GET | `/share/{id}/image` | public¹ | Returns original mime. |
| GET | `/sessions` | App Password | List own sessions. |
| DELETE | `/sessions/{id}` | App Password | Revoke. |

¹ Public-by-link (the ID is a 32-char URL-safe random + HMAC). Required because the LLM consuming the prompt has no WP credentials. Expiry enforced server-side; hourly cron sets status `Expired` and deletes files. Reads after expiry → `404`.

## D. Files on disk

`wp-content/uploads/pageport/{user_id}/{session_id}/{html|css|image}.{ext}` — outside the plugin dir so updates don't wipe assets. `.htaccess` in `pageport/` allows only the three known basenames.

## E. Cleanup

WP-Cron `pageport_cleanup` every hour: select `Active` rows where `expires_at < NOW()`, delete files via `wp_delete_file`, mark `Expired`. Manual `wp pageport cleanup` WP-CLI command for ops.

## F. Extension side

- New Settings group **Share Links**: `WP base URL`, `WP username`, `App password` (stored in `chrome.storage.local` under `pageport.share`).
- New SW handler `CreateShareSession` (in `background.ts`): POSTs multipart to `/wp-json/pageport/v1/sessions` with `Authorization: Basic base64(user:app_pass)`. On 401 → `E_SHARE_AUTH`. On network → `E_SHARE_NETWORK`. On 5xx → `E_SHARE_UPSTREAM`.
- Panel renders countdown chip from `expires_at` until panel close.

## G. Admin UI

`wp-admin → Tools → PagePort Sessions`: table of own sessions (status, kind, expires, revoke button). Site admins see all users.

## H. Security invariants

1. App password never leaves `chrome.storage.local`; never embedded in MD or clipboard payload.
2. `user_id` ownership re-checked on every authenticated route.
3. Session IDs are 32 bytes from `random_bytes`, base64url. Not enumerable.
4. File reads stream from disk; plugin never executes uploaded content.
5. `Content-Disposition: inline` + correct `Content-Type`; never `text/html` for image bytes.

## I. Acceptance

1. User installs plugin, creates app password, pastes into PagePort.
2. Share Links button enables, click → 3 URLs copied + AI block.
3. URLs return content; after 24h return 404.
4. Admin Sessions screen shows + revokes.
