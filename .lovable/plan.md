## PagePort v2.1 — Pairing Token + Share Links rework

### Locked decisions (this round)

1. **Capture stays.** PagePort still captures Full Page / Pick Element. Export & Share is bolted on.
2. **WP plugin = only backend.** No Lovable Cloud, no app server, no Facebook.
3. **Auth = pairing token** (replaces App Password). User pastes **one** token; the WP site URL is encoded inside it.
4. **No extension login.** Identity exists only on the WP side (pairing token → `wp_user_id`).
5. **Rate limiting = 24h share expiry + per-user quota in WP**, no extra infra.

### What gets removed / reworked

- `extension-src/shared/shareSettings.ts`: drop `baseUrl` + `username` + `appPassword` fields → replace with `{ pairingToken, siteUrl, tokenId }` (siteUrl + tokenId derived from token at pair time, stored for display + request routing).
- `extension-src/share/createShareSession.ts`: stop sending `Authorization: Basic`; send `Authorization: Bearer <pairingToken>` instead. Resolve endpoint from stored `siteUrl`.
- `wp-plugin/pageport/`: drop App Password permission callback; add new `pp_pairing_tokens` table + `class-pairing.php` + `class-auth.php` (Bearer token middleware).
- Spec files `24-export-modes.md`, `25-share-links.md`, `26-implementation-order-v2.md`: rewrite auth sections.
- `.lovable/plan.md` + `spec/plan.md`: bump V4–V7 to reflect pairing flow.
- Memory `index.md` Core line: change "auth via WP Application Passwords" → "auth via PagePort pairing tokens".

### Pairing token format

```text
PPT1.<base64url(payload)>.<base64url(hmac_sha256(payload, server_secret))>

payload = JSON {
  v: 1,
  site: "https://example.com",         // canonical WP base URL
  tid: "tok_<16 url-safe bytes>",      // token row PK
  uid: 42,                              // wp_users.ID
  iat: 1715300000,                     // issued-at (seconds)
  exp: null | 1730000000               // optional revocation hint
}
```

- Server secret lives in `wp_options` as `pageport_signing_key` (auto-generated on activation, 32 random bytes).
- `tid` is what the server looks up; HMAC just protects the payload from tampering on the wire.
- Revocation = delete the `pp_pairing_tokens` row → next request 401s.

### New WP plugin pieces

```
wp-plugin/pageport/includes/
  class-pairing.php      # generate / verify / revoke tokens
  class-auth.php         # REST permission_callback that parses Bearer
  admin/
    pairing-screen.php   # Tools → PagePort → "Pair a new device" button
                         # → modal with one-shot token (copy + close)
```

New REST routes (still under `pageport/v1`):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/sessions` | Bearer pairing token | Same multipart upload as before |
| GET  | `/share/{id}/{html\|css\|image}` | public, signed id | unchanged |
| GET  | `/sessions` | Bearer pairing token | List own sessions |
| DELETE | `/sessions/{id}` | Bearer pairing token | Revoke share |
| DELETE | `/pairing/self` | Bearer pairing token | Extension-side "unpair" |

Admin screen (`Tools → PagePort`): list of paired devices (label, last-used, revoke), and a button that mints a new token and shows it once.

### Extension UX

Settings → **Share Links** panel becomes a single field:

```
[ Paste pairing token ____________________ ] [Pair]

Paired with: example.com  ·  device #tok_a1b2  ·  Unpair
```

- On Pair: parse `PPT1.…`, decode `site` + `tid`, store `{ pairingToken, siteUrl, tokenId, pairedAt }` in `chrome.storage.local` under `pageport.share`.
- Share Links button in `ExportModes.tsx` gates on `Boolean(siteUrl && pairingToken)`.
- No pre-flight HTTP call; the first real upload is the validity test.

### Quota / rate limit (WP side, no extra infra)

- Per pairing token: max `N` active (non-expired) sessions. Default `N = 30`. When exceeded, `POST /sessions` returns `429` with `E_SHARE_QUOTA`.
- Hourly `pageport_cleanup` cron already deletes expired rows, so quota recovers automatically.
- `N` configurable in `wp_options` as `pageport_max_active_per_token`.

### Stage rewrite (replaces V4–V8)

- **V4'** WP scaffold: `pp_pairing_tokens` table, signing key on activation, Tools → PagePort empty screen, packaging script update.
- **V5'** Pairing UI in wp-admin: mint, list, revoke. `class-pairing.php` + `class-auth.php`.
- **V6'** REST `/sessions` (POST + LIST + DELETE) gated by Bearer middleware; quota check; existing public `/share/{id}/…` reads unchanged.
- **V7'** Extension Settings rewrite: pairing field, decode token, store, "Unpair" button. `createShareSession.ts` switches to Bearer.
- **V8'** Polish + AC: error codes (`E_SHARE_AUTH`, `E_SHARE_QUOTA`, `E_SHARE_NETWORK`, `E_SHARE_UPSTREAM`, `E_SHARE_BAD_TOKEN`), repackage `pageport.zip` + `pageport-wp.zip`, update landing page copy and `store/` docs.

### Out of scope (explicit)

- Facebook share, OAuth, app-server admin panel, extension-side accounts, pairing via deep link or QR code, Lovable Cloud.

### Open question I will resolve while implementing (not blocking)

- Whether to also store a short human label per token (e.g. "Chrome on Mac"). Default: yes, populated from `navigator.userAgent` at pair time, editable in wp-admin.

Reply **next** to start V4' (WP scaffold + pairing tokens table), or tell me to start somewhere else.