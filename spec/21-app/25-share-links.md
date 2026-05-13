# 25 — Smart Share via WordPress plugin

Status: LOCKED for v2.2. Backend = a self-hosted WordPress plugin shipped alongside the extension.

> **History.** v2.0 used Inspect Page pairing tokens (`PPT1.<payload>.<hmac>`)
> with `Authorization: Bearer …`. v2.2 replaced that with the standard
> WordPress login cookie + `X-WP-Nonce` (no shared secrets, no token
> paste). All pairing-token machinery has been removed.

## A. Why WP + cookie/nonce auth

- Zero new infra; user already has a WP site (or installs one).
- Auth uses WordPress's built-in `is_user_logged_in()` + `wp_verify_nonce( … 'wp_rest' )`. No tokens, no Application Passwords, no OAuth.
- The extension stores only the user-typed `siteUrl` plus a *cached* identity (display name, email, current `wp_rest` nonce). Nothing security-sensitive is ever persisted — the actual auth lives in the WP cookie inside Chrome's cookie jar.

## B. Plugin layout (`wp-content/plugins/inspect-page/`)

```
inspect-page.php              # plugin header + bootstrap
includes/
  class-activator.php     # creates 5 tables on activation
  class-auth.php          # require_wp_user permission_callback + GET /me
  class-rest.php          # registers REST routes + serves /share/{id}/...
  class-cleanup.php       # hourly wp-cron expiry sweep + rate-event prune
  class-storage.php       # upload helpers (uses wp_upload_dir)
  class-admin.php         # Tools → Inspect Page Sessions + hidden inspect-page-bridge
  enums.php               # PHP const-class mirrors of code enums
uninstall.php
```

Tables (all prefixed `{$wpdb->prefix}pp_`): `share_sessions`, `share_assets`, `share_session_statuses`, `share_session_kinds`, `share_asset_types`, `rate_events`. Status / Kind / AssetType seed rows on activation. Quota knobs in `wp_options`: `inspect_page_max_active_per_user` (default **30**), `inspect_page_max_uploads_per_hour` (default **60**), `inspect_page_expire_hours` (default **24**).

## C. REST routes (namespace `inspect-page/v1`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/auth-status` | cookie (optional) | `{ logged_in, user_id, display_name, email, nonce, quota }`. Used by extension to bootstrap + refresh the nonce. |
| POST | `/sessions` | cookie + `X-WP-Nonce` | Create session, multipart with `html`, `css`, `js`, `image` (+ optional `prompt`, `kind`, `source_url`). Strips EXIF on image. Enforces per-user **active** quota and **uploads/hour** quota (records `pp_rate_events`). Returns `{ session_id, expires_at, urls: { html, css, js, image } }`. |
| GET | `/sessions` | cookie + `X-WP-Nonce` | List own sessions (kind, status, expiry, asset URLs). |
| DELETE | `/sessions/{id}` | cookie + `X-WP-Nonce` | Revoke a share. |
| GET | `/share/{id}/index.html` | public¹ | Returns `text/html`. |
| GET | `/share/{id}/style.css`  | public¹ | Returns `text/css`. |
| GET | `/share/{id}/script.js`  | public¹ | Returns `application/javascript`. |
| GET | `/share/{id}/preview.png` | public¹ | Returns original mime (`image/png` or `image/jpeg`). |

¹ Public-by-link (the ID is 32 random bytes, base64url, 43 chars). Required because the LLM consuming the prompt has no WP credentials. Expiry enforced server-side; hourly cron sets status `Expired` and deletes files. Reads after expiry / revoke → `404`. Responses include `Content-Type`, `Cache-Control: public, max-age=300, immutable`, and permissive CORS.

## D. Files on disk

`wp-content/uploads/inspect-page/{user_id}/{session_id}/{index.html | style.css | script.js | preview.{png|jpg}}` — outside the plugin dir so updates don't wipe assets. `.htaccess` in `inspect-page/` allows only the four known basenames.

Size caps enforced server-side: HTML 256 KB, CSS 256 KB, JS 256 KB, image 5 MB, prompt 4000 chars.

## E. Cleanup

WP-Cron `inspect_page_cron_expire_sessions` every hour:
1. Select `Active` rows where `expires_at < UTC_TIMESTAMP()`, `wp_delete_file` each asset, mark `Expired`.
2. `DELETE FROM {$p}rate_events WHERE created_at < (UTC_TIMESTAMP() - INTERVAL 2 HOUR)`.

## F. Extension side

- Settings group **Smart Share (WordPress)** has a single text field: paste your WP site URL. Sign-in is a button: opens `…/wp-admin/admin.php?page=inspect-page-bridge` in a new tab. The hidden bridge page (`class-admin.php → render_bridge`) calls `wp_create_nonce('wp_rest')` and forwards `{ kind:'inspect-page-bridge', nonce, userId, displayName, email }` back to the extension via `window.opener.postMessage` (origin-locked). The SW persists `{ siteUrl, userId, displayName, email, nonce, signedInAtIso }` to `chrome.storage.local` under `inspect-page.share`. **Sign out** clears the cached identity locally; the WP cookie itself is unaffected.
- SW handler `CreateShareSession` POSTs multipart to `/wp-json/inspect-page/v1/sessions` with `credentials: 'include'` + `X-WP-Nonce: <nonce>`. SW handler `RevokeShareSession` `DELETE`s `/wp-json/inspect-page/v1/sessions/{id}` with the same headers. Status mapping (both): 401/403 → `E_SHARE_AUTH` (also clears cached `nonce`/`userId`), 429 → `E_SHARE_QUOTA`, 5xx → `E_SHARE_UPSTREAM`, network → `E_SHARE_NETWORK`, other 4xx → `E_SHARE_BAD_INPUT`.
- After a successful upload the panel opens the **Share dialog**: 4 URL rows with copy buttons, a live 24h countdown derived from `expires_at`, **Copy AI prompt + 4 URLs**, and **Revoke now**.

## G. Admin UI

- `wp-admin → Tools → Inspect Page Sessions` — table of own sessions (status, kind, expires, revoke button). Site admins see all users.
- `wp-admin → Tools → Inspect Page Settings` — read-only view of current quotas + active-session counters (`inspect_page_max_active_per_user`, `inspect_page_max_uploads_per_hour`, `inspect_page_expire_hours`).
- Hidden `wp-admin → admin.php?page=inspect-page-bridge` — used only by the extension login popup; no menu entry.

## H. Security invariants

1. The WP login cookie never leaves Chrome's cookie jar; the extension never reads it. The cached `nonce` is short-lived (12-24h server side) and bound to the user via `wp_rest`.
2. `user_id` ownership re-checked on every authenticated route (no horizontal escalation).
3. Session IDs are 32 bytes from `random_bytes`, base64url (43 chars). Not enumerable.
4. File reads stream from disk; plugin never executes uploaded content.
5. `Content-Disposition: inline` + correct `Content-Type`; never `text/html` for image / JS bytes.
6. Image uploads are passed through `wp_get_image_editor` to strip EXIF before save.
7. The `inspect-page-bridge` page only `postMessage`s to `window.opener` and only when `is_user_logged_in()` — never iframable (`X-Frame-Options: DENY`).
8. Per-user quotas (`max_active`, `max_uploads_per_hour`) bound disk usage and prevent abuse.

## I. Acceptance

See [`docs/ACCEPTANCE-v2.2.md`](../../docs/ACCEPTANCE-v2.2.md) for the live-WP checklist. Summary:

1. User installs the plugin, opens **Settings → Smart Share** in the extension, pastes site URL, clicks **Sign in**, signs in to WP — extension shows display name + active quota.
2. Smart Share button uploads → Share dialog opens with 4 working URLs + countdown.
3. URLs return content over `curl`; after 24h or after **Revoke now** they return 404.
4. **Tools → Inspect Page Sessions** shows + revokes; signing out of WP causes the next upload to return `401 E_SHARE_AUTH` and clears the cached nonce.
5. Exceeding `inspect_page_max_active_per_user` (default 30) or `inspect_page_max_uploads_per_hour` (default 60) returns `429 E_SHARE_QUOTA`.
