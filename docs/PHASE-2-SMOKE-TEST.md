# Phase 2 — End-to-End Smoke Test (Inspect Page on Hostinger WP)

Goal: prove the full pipeline (sign-in → 4 export modes → Smart Share → free-quota gate → license unlock → cron cleanup) works on your **live** Hostinger WordPress before we add a public landing page or payments.

You'll do this once. Tick each box. If anything fails, paste the failing step + error here and I'll patch it before we move on.

---

## 0. Prerequisites (one-time)

- [ ] WordPress site reachable over HTTPS at `https://YOUR-SITE.com`.
- [ ] Inspect Page plugin (`public/inspect-page-wp.zip`) installed & **Activated** (Plugins → Installed Plugins).
- [ ] Permalinks set to **Post name** (Settings → Permalinks → Save once). Required for `/wp-json/...` routes.
- [ ] You have at least one WP user account (admin is fine for testing).
- [ ] Inspect Page extension loaded in Chrome (`chrome://extensions` → Developer mode → Load unpacked from `extension/dist/`, or install the packed `public/inspect-page.zip`).
- [ ] In Chrome DevTools → Application → Storage, you can see `chrome-extension://<id>` entries (just confirms the extension is alive).

---

## 1. Sign-in flow (cookie + nonce bridge)

1. Open the extension popup → click **Sign in to WordPress**.
2. A new tab opens at your WP login page. Sign in.
3. You're redirected to a page that says "Inspect Page paired" (the hidden bridge admin page) and the tab auto-closes within ~2 seconds.
4. Re-open the popup. It should now show: **Signed in as `<your display name>`** and **Free shares used: 0 / 5**.

✅ Pass criteria: popup shows your name + email + the 0/5 quota line.
❌ Fail symptoms: "Sign in" button still visible after login → see Troubleshooting §A.

---

## 2. Export Page — 4 modes

Pick a real article page (e.g. a Wikipedia page). Open the floating panel (toolbar icon → "Open panel" or `Alt+Shift+P`).

- [ ] **MD single** → downloads `inspect-page-fullpage-<slug>-<ts>.md`. Open it: image is inline base64, content readable.
- [ ] **MD + files** → downloads `inspect-page-fullpage-<slug>-<ts>.zip` containing `index.md`, `assets/` folder with screenshot.
- [ ] **ZIP** → downloads zip with `index.html`, `style.css`, `script.js`, `screenshot.png`, **`prompt.md`** at root.
- [ ] **Smart Share** → modal opens with 4 URLs (html / css / js / preview), countdown reads ~23h 59m, "Copy AI prompt + 4 URLs" button copies to clipboard. Open one URL in an Incognito window → file loads.

---

## 3. Pick Element — 4 modes

On the same page, click **Pick Element**, hover & click a card/section.

- [ ] All 4 modes (MD / MD+files / ZIP / Smart Share) work the same way as §2 but scoped to the picked element.
- [ ] Element screenshot is the cropped element only, not the full page.

---

## 4. Free-quota gate (the lifetime 5)

You've now created some Smart Shares. Check the popup quota counter — it should say **N / 5**.

1. Keep clicking Smart Share on any page until you've created **5 total** Smart Share sessions across this user's lifetime.
2. Try a **6th** Smart Share.

✅ Pass: toast appears: *"Free quota reached. Upgrade to Inspect Page Pro to keep sharing."* Network tab shows `402 E_SHARE_QUOTA_FREE`.

---

## 5. License unlock (manual admin grant)

Until Stripe is wired (Phase 4), Pro is granted by hand:

1. WP admin → **Users** → click your user.
2. Scroll to **"Inspect Page License"** field (added by the plugin) → set to `active` → Update User.
   - *(If the field isn't visible, run this once in `Tools → Site Health → Info → wp-cli`, or via WP-CLI: `wp user meta update <user_id> inspect_page_license active`.)*
3. Back in the extension, retry Smart Share on any page.

✅ Pass: 6th share succeeds, popup now reads **Pro — unlimited**.

---

## 6. Cron cleanup (24h expiry)

You don't want to wait 24h. Force it:

1. SSH/WP-CLI into Hostinger: `wp inspect-page cleanup` → expect output like `Revoked N sessions, deleted M files.`
2. **Or** in phpMyAdmin: open `wp_pp_share_sessions`, pick one of your test rows, set `expires_at` to 1 hour ago, then run `wp cron event run inspect_page_cleanup_event`.
3. Re-open the public share URL from §2 → expect **404** (file deleted) and the row's `status_id` is now `revoked`.

✅ Pass: expired session's files vanish from `wp-content/uploads/inspect-page/<user_id>/<session_id>/` and the public URL 404s.

---

## 7. WP admin sanity

- [ ] **Tools → Inspect Page Sessions** lists your test sessions with columns: ID, User, Kind, Status, Expires, JS column.
- [ ] Per-row **Revoke** button works: click → row turns "revoked", files deleted, public URL 404s.
- [ ] **Settings → Inspect Page** dashboard shows: REST health green, permalinks OK, your quota counter, recent 10 sessions.

---

## Troubleshooting

**§A — Sign-in didn't stick**
- Check `chrome://extensions` → Inspect Page → "service worker" → Console. Look for `[inspect-page] bridge nonce received` log line.
- If missing: WP site URL constant in extension may not match. The extension ships with one baked-in URL (the official Inspect Page backend). For self-host testing, edit `extension-src/shared/constants.ts` → `INSPECT_PAGE_WP_SITE_URL`, rebuild (`bun run build` in `extension/`), reload the unpacked extension.
- CORS: the WP plugin auto-allows the extension origin via `Access-Control-Allow-Origin: chrome-extension://<id>` from `class-rest.php`. If browser console shows a CORS error, confirm Hostinger isn't stripping the header — add it in `.htaccess` if needed.

**§B — `402` even after setting license**
- Verify the user meta key is exactly `inspect_page_license` (not `pageport_license` left over from rebrand) and value is exactly `active` (lowercase).
- The migration from `pageport_license` runs once on plugin activation. If you set the old key after activating the renamed plugin, run: `wp user meta update <id> inspect_page_license active`.

**§C — Public share URL returns 404 immediately**
- Permalinks not flushed → Settings → Permalinks → Save (don't change the value, just Save).
- Or the file isn't in `wp-content/uploads/inspect-page/<user_id>/<session_id>/` → check WP error log + Hostinger file manager.

---

## Helper: REST round-trip script

`scripts/smoke-rest.sh` (added in this phase) does a no-extension dry run. Usage:

```bash
SITE=https://your-site.com USER=admin PASS='your-app-password' \
  bash scripts/smoke-rest.sh
```

It will:
1. Get a `wp_rest` nonce via Application Password basic auth.
2. POST a tiny fake session (4 small files) to `/inspect-page/v1/sessions`.
3. Print the 4 returned URLs.
4. cURL each one and assert HTTP 200.
5. DELETE the session and assert the URLs now return 404.

If this script passes against your live Hostinger but the extension still fails, the bug is in the extension layer, not the backend.

---

## When you're done

Reply **next** with either:
- *"all green"* → I'll start **Phase 3** (public landing page + signup story).
- A copy-pasted error from any failing step → I'll patch it first.