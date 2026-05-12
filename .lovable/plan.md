
## PagePort v2.2 — Smart Share (WP-only backend, user login)

Replaces the pairing-token Share Links mode with an auth-gated Smart Share flow. Backend stays 100% in the WordPress plugin — no Lovable Cloud, no extension accounts. Identity is a real WP user (email + Google via Nextend Social Login). The extension talks to WP through a short-lived session cookie set inside an iframe login modal, then issues uploads with that cookie + a nonce.

### Conflicts resolved (from your answers)

- Backend: WP plugin only. WP handles auth, storage, rate limiting, expiry.
- Files: 4 per session — `index.html`, `style.css`, `script.js`, `preview.png`.
- Trigger: replaces the current "Share Links" export mode in the extension panel. Pairing-token UI in Settings is removed.
- Rate limiting: implemented inside the plugin (count-based, no external infra).

### What changes vs. current code

Removed
- `extension-src/shared/shareSettings.ts` (pairing token storage)
- `extension-src/shared/__tests__/parsePairingToken.test.ts`
- "Share Links" Settings panel (pairing token paste/unpair)
- WP `class-pairing.php`, `pp_pairing_tokens` table, `Tools → PagePort` pairing screen
- Bearer-token middleware in `class-auth.php`

Added / reworked
- WP plugin: WP-user auth + Google sign-in, JS capture, `script.js` asset, `/api/share/...` public read routes, per-user hourly + active quota, rate-limit table.
- Extension: Smart Share button, login modal (iframe to `/wp-login.php` + `/wp-admin/admin-ajax.php?action=pageport_session`), JS collector, new copy-package payload.
- Landing page: "Smart Share" section replaces pairing-token copy.

---

## A. WordPress plugin changes

### A1. Auth model

- Drop pairing tokens entirely.
- Authenticated REST routes use a new permission callback `PagePort_Auth::require_wp_user`:
  - Accepts a logged-in WP cookie session (`wp_validate_auth_cookie`) **plus** a `X-WP-Nonce` header (`wp_rest` nonce).
  - Returns 401 `E_SHARE_AUTH` otherwise.
- New endpoint `GET /wp-json/pageport/v1/me` returns `{ user_id, display_name, email, nonce, quota: { active, max_active, hourly_used, max_hourly } }`. Used by the extension to detect login state.
- Google sign-in: plugin checks for **Nextend Social Login** at activation; if missing, the admin screen shows a one-click "Install Nextend" notice (uses `Plugin_Upgrader`). Email/password works out of the box via core WP.

### A2. Tables (replaces pairing_tokens)

```text
{prefix}pp_share_sessions   (existing — add `prompt` text column)
{prefix}pp_share_assets     (existing — extend asset_type enum with 'js')
{prefix}pp_share_asset_types(seed row 'js')
{prefix}pp_rate_events      NEW: id, user_id, created_at  (for hourly count)
```

Migration in `class-activator.php` runs on plugin upgrade (version bump → 2.2.0).

### A3. REST routes (namespace `pageport/v1`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET  | `/me` | WP cookie + nonce | login probe + quota |
| POST | `/sessions` | WP cookie + nonce | multipart: `html`, `css`, `js`, `image`, optional `prompt`, `source_url` |
| GET  | `/sessions` | WP cookie + nonce | list own |
| DELETE | `/sessions/{id}` | WP cookie + nonce | revoke |
| GET  | `/share/{id}/index.html` | public | `text/html` |
| GET  | `/share/{id}/style.css`  | public | `text/css` |
| GET  | `/share/{id}/script.js`  | public | `text/javascript` (empty file if no JS captured) |
| GET  | `/share/{id}/preview.png`| public | original mime, header always `image/png` or `image/jpeg` |

Public reads add headers: `Cache-Control: public, max-age=300`, `X-Content-Type-Options: nosniff`, `Access-Control-Allow-Origin: *`. `share_id` validated against `^[A-Za-z0-9_-]{16,}$` (we keep the existing 43-char base64url IDs — already satisfies the regex).

### A4. Limits (in plugin)

- `pageport_max_active_per_user` (default 30) — active non-expired sessions.
- `pageport_max_per_hour_per_user` (default 30) — count of `pp_rate_events` rows in last 60 min.
- File size caps: HTML/CSS/JS 256 KB, image 5 MB.
- Image EXIF strip via `wp_get_image_editor()->save()` re-encode pass.
- Cron `pageport_cleanup` already handles 24h expiry; extended to also prune `pp_rate_events` older than 2h.

### A5. Admin screen

`Tools → PagePort` becomes:
- Quota settings (active/hour caps).
- Sessions table (own / all-for-admins) with revoke.
- "Google sign-in status" row pointing at Nextend.

No more pairing UI.

---

## B. Extension changes

### B1. Settings panel

Delete the "Share Links (WordPress)" group entirely. Replace with a single field **WordPress site URL** (`https://example.com`) saved under `pageport.share = { siteUrl }`. No tokens stored anywhere.

### B2. Smart Share flow (in `ExportModes.tsx`)

1. User clicks **Smart Share**.
2. Extension calls `GET {siteUrl}/wp-json/pageport/v1/me` with `credentials: 'include'`.
3. If 401 → open **Login Modal** (chrome `windows.create` popup pointed at `{siteUrl}/wp-login.php?redirect_to=/wp-admin/admin.php?page=pageport-bridge`). The bridge page is served by the plugin and posts `window.opener.postMessage({ type: 'pageport:auth-ok', nonce })` then closes. The extension listens via `chrome.runtime.onMessage` from a content script injected on the bridge URL.
4. After auth, extension re-runs the export pipeline (HTML + CSS + JS + screenshot) and POSTs multipart to `/sessions` with `X-WP-Nonce`.
5. On 201, opens **Share Dialog** with the 4 URLs, countdown, revoke, and Copy Share Package button.

### B3. JS capture

New `extension-src/capture/collectJs.ts`:
- Walks all `<script>` tags in main document (skipping cross-origin without CORS).
- Inline scripts → concatenated as-is with `// === inline #N ===` separators.
- External same-origin scripts → fetched and inlined.
- External cross-origin → emitted as `// external (not inlined): <url>` comment.
- Hard cap 256 KB; truncate with `// [truncated]` footer.
- If nothing collected → empty string (still uploaded so URL count stays 4).

Wired into `collectArtifacts.ts`.

### B4. Share Dialog (new component `extension-src/share/ShareDialog.tsx`)

- 4 labeled URL rows with mini copy icons.
- Primary "Copy Share Package" button — clipboard payload exactly:

```text
I'm sharing a UI component with you. Please read all four files first, then apply the change I describe at the end.

HTML:    {html_url}
CSS:     {css_url}
JS:      {js_url}
Image:   {img_url}

Instructions:
1. Fetch and read the HTML to understand the current markup and structure.
2. Fetch and read the CSS to understand the current styling, tokens, and breakpoints.
3. Fetch and read the JS to understand any current behavior.
4. Open the image to see how the component currently renders.
5. Then make the change requested below — modify HTML/CSS/JS only. Do not break the existing structure, semantics, or responsiveness unless I ask for it. You may add animations, restyle, or adjust layout.

My request:
<write your change request here>
```

- Live `expires in HHh MMm` countdown (ticks every 30s while panel open).
- Revoke button → `DELETE /sessions/{id}` → toast + dialog close.
- Toast on copy success via existing `sonner`.

### B5. Error mapping

`E_SHARE_AUTH` (401/403), `E_SHARE_QUOTA` (429), `E_SHARE_UPSTREAM` (5xx), `E_SHARE_NETWORK` (fetch fail), `E_SHARE_BAD_INPUT` (other 4xx). Surfaced inline in the dialog.

---

## C. Landing page (src/)

- `WpPlugin.tsx`: rewrite copy — install plugin → log in (or sign up with Google) → click Smart Share. Drop pairing-token language.
- `WhatsNew.tsx`: add v2.2 entry "Smart Share — login + 4 URLs + AI prompt".
- `Hero.tsx` badge stays "v2.0" or bumps to "v2.2".

---

## D. Stage order (replaces V4'–V8' in `.lovable/plan.md`)

1. **S1** WP migration: drop pairing tables, add `prompt` column, `js` asset type, `pp_rate_events` table, version bump 2.2.0.
2. **S2** WP auth: `class-auth.php` cookie+nonce middleware, `/me` route, bridge admin page for popup hand-off, Nextend status check.
3. **S3** WP routes: `/sessions` POST/LIST/DELETE rebuilt against WP user; quota + EXIF strip; public `/share/{id}/{file}` paths renamed to spec.
4. **S4** Extension: remove pairing UI, add `siteUrl`-only setting, JS collector, Smart Share button, login popup + postMessage bridge.
5. **S5** Extension: Share Dialog with countdown, revoke, copy-package payload.
6. **S6** Landing + docs + repackage `pageport.zip` and `pageport-wp.zip`, update `spec/21-app/24,25,26.md` and memory index.
7. **S7** Acceptance pass: curl all 4 URLs, expire, revoke, quota, login modal, logout.

---

## E. Open items I will assume unless you object

- Google sign-in via **Nextend Social Login** (free plugin). If you want a different provider plugin, say so.
- Login uses a popup window, not an embedded iframe (Google blocks OAuth inside iframes — popup is the only reliable option for a Chrome extension).
- We keep storing files on the WP filesystem under `wp-content/uploads/pageport/{user_id}/{share_id}/`. Public reads stream through PHP so we can enforce expiry/revoke (no direct hotlinking).
- Existing public URL shape changes from `/share/{id}/html` to `/share/{id}/index.html` etc. as your spec requires — old links break (acceptable, none in production).

Reply **go** to start with S1, or call out anything to change.
