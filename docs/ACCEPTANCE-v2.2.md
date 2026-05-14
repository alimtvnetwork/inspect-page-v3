# Inspect Page v2.2 Smart Share — Acceptance Checklist

The sandbox cannot run WordPress, so this checklist is the source of truth
for verifying a fresh install against a real WP site.

## Prereqs

- WordPress ≥ 5.6, PHP ≥ 7.4, HTTPS site (cookies + cross-origin XHR).
- Fresh Chrome profile with `inspect-page.zip` (v2.2) loaded unpacked.
- `inspect-page-wp.zip` (v2.2.0) unzipped to `wp-content/plugins/inspect-page/`
  and **Activated** in wp-admin → Plugins.

## 1. Sign-in flow

1. In the extension popup, expand **Settings → Smart Share (WordPress)**.
2. Paste your site URL (e.g. `https://example.com`), tab out → it should
   normalize (no trailing slash, http(s) only).
3. Click **Sign in**. A new tab opens at
   `…/wp-admin/admin.php?page=inspect-page-bridge`.
4. Sign in with your WP user (or you're already logged in).
5. The bridge page auto-closes; the extension panel updates within ~2 s
   to show **Signed in as &lt;display name&gt; · &lt;hostname&gt;**.

PASS criteria: settings now contain a non-empty `nonce` and `userId`.
No tokens or passwords were typed.

## 2. Smart Share upload (4 files → 4 URLs)

1. Run **Export Full Page** on any HTTPS page.
2. In **Export for AI**, pick **Share Links**.
3. Upload should complete in &lt; 5 s; the **Share dialog** opens with:
   - 4 input rows (HTML / CSS / JS / Image) showing
     `…/wp-json/inspect-page/v1/share/&lt;43-char-id&gt;/index.html`,
     `/style.css`, `/script.js`, `/preview.png`.
   - Live countdown showing `~23h 59m 59s` ticking down.
4. Click each row's **Copy** → button label flips to **Copied** for ~1.5 s.
5. Click **Copy AI prompt + 4 URLs** → clipboard contains the full AI
   instruction block with all 4 URLs interpolated.

Verify with curl (no auth needed for public reads):

```bash
for f in index.html style.css script.js preview.png; do
  curl -sI "$BASE/wp-json/inspect-page/v1/share/$ID/$f" | head -1
done
# expect: HTTP/1.1 200 OK (×4)
```

## 3. Revoke

1. In the same dialog click **Revoke now**.
2. Button shows "Revoking…" then dialog shows "Revoked. The links no
   longer work."
3. Re-run the curl loop above → all 4 should now return **404**.

## 4. Quota

1. Loop the upload 30 times (Smart Share on 30 different pages or
   re-export 30 times). Each succeeds.
2. Attempt the 31st → extension shows error
   `E_SHARE_QUOTA — Share quota reached. Revoke old links in WordPress
   and try again.`
3. Revoke any one session in **Tools → Inspect Page Sessions** → next upload
   succeeds.

## 5. Hourly burst quota

1. From a fresh hour boundary, attempt &gt; 60 uploads in one hour
   (revoke in between to stay under the active quota).
2. Upload #61 returns the same `E_SHARE_QUOTA` toast.

## 6. Expiry

1. Either wait 24 h or temporarily set
   `define( 'INSPECT_PAGE_EXPIRE_HOURS', 0 );` in `wp-config.php` and run
   the cron job (`wp cron event run inspect_page_cron_expire_sessions`).
2. The countdown in the dialog should switch to **Expired** in red and
   the curl loop returns 404.

## 7. Sign-out / nonce expiry

1. In wp-admin click **Log out**.
2. In the extension click **I'm signed in — refresh** → status flips to
   **Not signed in to this site.** and `nonce` / `userId` are cleared.
3. Try Smart Share → error
   `E_SHARE_AUTH — WordPress session expired — sign in again from
   Settings → Smart Share.`

## 8. Regression: in-sandbox tests

Run from repo root:

```bash
cd extension && bunx vitest run
```

PASS criteria: **86 / 86 tests green**, including:

- `share/__tests__/createShareSession.test.ts` (8 cases)
- `share/__tests__/smokeE2E.test.ts` (2 cases — cookie+nonce mock)
- `share/__tests__/buildPromptMd.test.ts` (6 cases — 4-URL AI block)

## 9. Share-link analytics (WP 2.5.1 / Ext 2.5.5)

1. Create a Smart Share session, then `curl` each of the 4 returned URLs
   twice. In Settings → Recent Shares the row shows `👁 8`. Click it →
   per-file breakdown reads `html 2 · css 2 · js 2 · image 2` and the
   "last viewed" timestamp matches now (±1 min).
2. WP admin → Inspect Page → Sessions → toggle **Recent visitors** ON
   on a Pro account. Hit any asset URL → drawer lists 1 anonymised
   visitor (hashed IP/UA, file kind, ts).
3. Repeat (2) on a Free account → no rows are written; toggle is
   disabled with "Pro only" hint.
4. Regression: `cd extension && bunx vitest run` → **175 / 175 green**,
   including `share/__tests__/getSessionStats.test.ts` (9 cases).
