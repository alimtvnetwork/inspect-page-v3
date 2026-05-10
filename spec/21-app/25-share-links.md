# 25 — Share Links via WordPress plugin

Status: LOCKED for v2. Backend = a self-hosted WordPress plugin shipped alongside the extension.

## A. Why WP + PagePort pairing tokens

- Zero new infra; user already has a WP site (or installs one).
- The plugin mints **PagePort pairing tokens** (`PPT1.<base64url(payload)>.<base64url(hmac_sha256(payload, server_secret))>`). The payload encodes `{ v:1, site, tid, uid, iat, exp }` so the user pastes one string and the extension decodes the WordPress site URL automatically — no separate URL field, no Application Passwords, no OAuth.
- Every authenticated REST route uses `PagePort_Auth::require_bearer` which verifies the HMAC, looks up the `tid`, calls `wp_set_current_user( uid )`, and exposes the row to handlers via `PagePort_Auth::current_token()`.

## B. Plugin layout (`wp-content/plugins/pageport/`)

```
pageport.php              # plugin header + bootstrap
includes/
  class-activator.php     # creates 5 tables + signing key on activation
  class-pairing.php       # mint / verify / revoke / list pairing tokens
  class-auth.php          # Bearer permission_callback for REST routes
  class-rest.php          # registers REST routes
  class-cleanup.php       # hourly wp-cron expiry sweep
  class-storage.php       # upload helpers (uses wp_upload_dir)
  class-admin.php         # Tools → PagePort (pairing UI) + Tools → PagePort Sessions
  enums.php               # PHP const-class mirrors of code enums
uninstall.php
```

Tables (all prefixed `{$wpdb->prefix}pp_`): `share_sessions`, `share_assets`, `share_session_statuses`, `share_session_kinds`, `share_asset_types`, `pairing_tokens`. Status / Kind / AssetType seed rows on activation. `pageport_signing_key` (32 random bytes, hex) and `pageport_max_active_per_token` (default 30) live in `wp_options`.

## C. REST routes (namespace `pageport/v1`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/sessions` | Bearer pairing token | Create session, multipart with `html`, `css`, `image`. Enforces per-token quota (default 30 active). Returns `{ session_id, expires_at, urls: { html, css, image } }`. |
| GET | `/share/{id}/html` | public¹ | Returns `text/html`. |
| GET | `/share/{id}/css` | public¹ | Returns `text/css`. |
| GET | `/share/{id}/image` | public¹ | Returns original mime. |
| GET | `/sessions` | Bearer pairing token | List own sessions. |
| DELETE | `/sessions/{id}` | Bearer pairing token | Revoke a share. |
| DELETE | `/pairing/self` | Bearer pairing token | Extension-side unpair (revokes the calling token). |

¹ Public-by-link (the ID is a 32-char URL-safe random + HMAC). Required because the LLM consuming the prompt has no WP credentials. Expiry enforced server-side; hourly cron sets status `Expired` and deletes files. Reads after expiry → `404`.

## D. Files on disk

`wp-content/uploads/pageport/{user_id}/{session_id}/{html|css|image}.{ext}` — outside the plugin dir so updates don't wipe assets. `.htaccess` in `pageport/` allows only the three known basenames.

## E. Cleanup

WP-Cron `pageport_cleanup` every hour: select `Active` rows where `expires_at < NOW()`, delete files via `wp_delete_file`, mark `Expired`. Manual `wp pageport cleanup` WP-CLI command for ops.

## F. Extension side

- Settings group **Share Links** has a single field: paste a `PPT1.…` pairing token. The extension decodes `site` + `tid` from the payload (no signature check client-side; the WP server verifies on every request) and stores `{ pairingToken, siteUrl, tokenId, pairedAtIso }` in `chrome.storage.local` under `pageport.share`. An **Unpair** button clears the entry locally; the matching server-side token can be revoked from `Tools → PagePort` or via `DELETE /pairing/self`.
- SW handler `CreateShareSession` POSTs multipart to `/wp-json/pageport/v1/sessions` with `Authorization: Bearer <pairingToken>`. Status mapping: 401/403 → `E_SHARE_AUTH`, 429 → `E_SHARE_QUOTA`, 5xx → `E_SHARE_UPSTREAM`, network → `E_SHARE_NETWORK`, other 4xx → `E_SHARE_BAD_INPUT`.
- Panel renders countdown chip from `expires_at` until panel close.

## G. Admin UI

- `wp-admin → Tools → PagePort` — mint new pairing token (one-shot display), table of paired devices (label, created, last used, revoke).
- `wp-admin → Tools → PagePort Sessions` — table of own sessions (status, kind, expires, revoke button). Site admins see all users.

## H. Security invariants

1. Pairing token never leaves `chrome.storage.local`; never embedded in MD or clipboard payload.
2. `user_id` ownership re-checked on every authenticated route.
3. Session IDs are 32 bytes from `random_bytes`, base64url. Not enumerable.
4. File reads stream from disk; plugin never executes uploaded content.
5. `Content-Disposition: inline` + correct `Content-Type`; never `text/html` for image bytes.
6. Pairing-token HMAC uses `pageport_signing_key` (32 random bytes generated on activation, never exposed). Tampering with the payload invalidates the signature → 401.
7. Per-token quota (`pageport_max_active_per_token`, default 30) bounds disk usage and prevents one paired device from monopolising storage.

## I. Acceptance

1. User installs plugin, mints a pairing token in `Tools → PagePort`, pastes it into PagePort.
2. Share Links button enables, click → 3 URLs copied + AI block.
3. URLs return content; after 24h return 404.
4. Admin Sessions screen shows + revokes; admin Pairing screen revokes paired devices.
5. Exceeding `pageport_max_active_per_token` returns `429 E_SHARE_QUOTA`.
