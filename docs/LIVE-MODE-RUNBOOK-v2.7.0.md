# Live-mode launch runbook — Inspect Page v2.7.0 / WP v2.6.0

Single-operator script for flipping the WP plugin + Chrome extension from
test/staging to production. Run top-to-bottom; do not skip steps.

Estimated wall-clock time: ~45 min (excludes Chrome Web Store review).

Pre-reqs (gather these before starting):

- [ ] Production WP admin login (Owner role)
- [ ] Stripe **live** secret key (`sk_live_…`)
- [ ] Stripe **live** publishable key (`pk_live_…`) — only if surfaced in UI
- [ ] Stripe **live** price id for "Inspect Page Pro" (`price_…`)
- [ ] Stripe **live** webhook signing secret (`whsec_…`) — created in step 3
- [ ] Production WP site URL, https, no trailing slash (e.g. `https://app.inspectpage.com`)
- [ ] Chrome Web Store developer console access
- [ ] Local clone on `main` with v2.7.0 already merged

---

## 1. Freeze + snapshot

1. In WP admin → **Tools → Inspect Page** → screenshot the Account / Quotas
   panel for a "before" record.
2. `wp db export pre-live-$(date +%F).sql` on the prod box (or use your
   managed-host snapshot button). Keep the dump for 30 days.
3. Announce a 15-min freeze in your ops channel: no extension uploads, no
   plugin re-installs.

## 2. Bake the prod WP URL into the extension

File: `extension-src/shared/constants.ts`

```ts
// Replace:
export const INSPECT_PAGE_WP_SITE_URL = "";
// With your prod URL, https, no trailing slash:
export const INSPECT_PAGE_WP_SITE_URL = "https://app.inspectpage.com";
```

Rebuild + repackage:

```bash
cd extension
bun install
bun run build
bash scripts/package.sh
cd .. && sha256sum public/inspect-page.zip > public/inspect-page.zip.sha256
```

Sanity-check the baked URL:

```bash
unzip -p public/inspect-page.zip assets/*.js \
  | grep -o 'https://app.inspectpage.com' | head -1
```

Expected: prints the URL exactly once per chunk that references it. If
empty → constant didn't get inlined; re-check the build log.

## 3. Create the Stripe **live** webhook endpoint

1. Stripe dashboard → toggle **Viewing test data → off** (top-right).
2. **Developers → Webhooks → Add endpoint**:
   - URL: `https://app.inspectpage.com/wp-json/inspect-page/v1/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_failed`.
3. Reveal the signing secret (`whsec_…`) — you only see it once. Copy it
   straight into step 4.

## 4. Wire live keys into WP

`wp-admin → Settings → Inspect Page → Billing`:

- [ ] **Stripe mode**: Live
- [ ] **Secret key**: `sk_live_…`
- [ ] **Webhook secret**: `whsec_…` from step 3
- [ ] **Pro price id**: `price_…` (live)
- [ ] **Customer Portal return URL**: `https://app.inspectpage.com/wp-admin/admin.php?page=inspect-page`

Click **Save**, then click **Test connection** — must return:

```
OK · live mode · price_live_… resolved (USD $5.00 / month)
```

If "price not found" → wrong env. Re-check Stripe mode toggle on both
sides.

## 5. Smoke the webhook (end-to-end, live mode)

Use a real card you can refund (`4242 4242 4242 4242` does **not** work in
live mode).

1. From the new extension build: Settings → Smart Share → **Upgrade to Pro**.
2. Complete Checkout with a real card.
3. Within 10 s, in WP: `wp db query "SELECT license_status, stripe_customer_id, stripe_subscription_id FROM wp_pp_workspaces WHERE id = <your_ws_id>"`
   should show `active` + populated ids.
4. Tail: `wp log tail | grep '[inspect-page]'` — expect `webhook ok event=checkout.session.completed sig=verified`.
5. Refund + cancel from Stripe dashboard. Wait 10 s. Re-query — status flips
   to `canceled`.

If steps 3 or 4 fail → see **Rollback** below; do not proceed.

## 6. Walk the acceptance matrix

Tick these from `docs/PHASE-6-LAUNCH-CHECKLIST.md` against the live env:

- [ ] AC-BILL-1 … AC-BILL-5
- [ ] AC-ANALYTICS-1 … AC-ANALYTICS-3
- [ ] AC-UI-259-1 … AC-UI-259-3
- [ ] AC-WS-1 … AC-WS-7

Record PASS/FAIL inline in that file and commit.

## 7. Run the pen-test pass

`bash docs/PEN-TEST-v2.7.0.md` step-by-step against the live host. All 9
tests must return the expected status code / error code. File any FAIL as
a blocker — do not proceed to CWS upload.

## 8. Chrome Web Store upload

1. `public/inspect-page.zip` (the one built in step 2) → CWS dev console →
   **Package → Upload new package**.
2. Description / "What's new" → paste from `store-assets/listing-2.7.0.md`.
3. Screenshots → 5 PNGs per `docs/SCREENSHOT-SHOTLIST-v2.7.md`. Replace
   `store-assets/screen-{1..5}.png`.
4. **Submit for review**.

Note: review typically 1–3 business days. Do **not** also bump the WP
plugin version mid-review — wait for the extension to go live first to
keep the version-pin contract intact.

## 9. Tag the release in git

After CWS marks the extension **Published**:

```bash
git tag ext-v2.7.0 -m "Chrome extension v2.7.0 — Team Workspaces"
git tag wp-v2.6.0  -m "WP plugin v2.6.0 — Team Workspaces"
git push origin ext-v2.7.0 wp-v2.6.0
```

## 10. Post-launch watch (first 24 h)

- [ ] WP error log: `wp log tail | grep -E 'inspect-page.*(ERROR|WARN)'`
- [ ] Stripe dashboard → Webhooks → success rate ≥ 99%
- [ ] `SELECT COUNT(*) FROM wp_pp_share_sessions WHERE created_at > NOW() - INTERVAL 1 HOUR`
      — sanity-check share volume vs. baseline
- [ ] CWS dashboard → crash / uninstall spike?

---

## Rollback (if step 5, 6, or 7 fails)

1. In WP Billing settings → flip **Stripe mode** back to Test.
2. Stripe dashboard → disable the live webhook endpoint (do **not** delete
   — you'll need the signing secret again).
3. `wp db import pre-live-YYYY-MM-DD.sql` from step 1.
4. If the extension was already uploaded to CWS: dev console → **Unpublish**
   the in-review submission. Old v2.6.x stays live for users.
5. Open a postmortem ticket with: failing step number, observed log line,
   Stripe event id (if any), workspace id (if any).