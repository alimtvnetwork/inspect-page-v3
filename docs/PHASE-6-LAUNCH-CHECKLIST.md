# Phase 6 — Hardening + Chrome Web Store launch checklist

Last updated: 14 May 2026 · Status: in progress · Targets **extension v2.5.0** + **WP plugin v2.4.0**

This is the final gate before flipping the listing to **Public** on the Chrome
Web Store. Everything below must be checked off (or explicitly waived) before
submitting.

## 1. Security pass

- [x] CSP / framing headers on shared HTML asset (`class-rest.php::read_asset`)
      — `default-src 'none'`, no scripts, `frame-ancestors 'self'`.
- [x] `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
      `Permissions-Policy` set on every shared asset response.
- [x] EXIF stripped from uploaded screenshots (`strip_exif` via WP image editor).
- [x] All REST writes are cookie + `X-WP-Nonce` gated; reads are public-by-id
      only (`/share/{id}/{slug}`) and 404 after expiry/revoke.
- [x] `?inspect_page_revoke=` shortcode handler is `wp_verify_nonce` gated
      and ownership-checked before deleting files.
- [ ] Pen-test: try (a) revoking another user's session, (b) uploading >10MB
      file, (c) hammering POST /sessions to trigger 429, (d) requesting an
      asset with a `..` path traversal in the slug. Document results below.
- [ ] Verify `INSPECT_PAGE_WP_SITE_URL` is set to the production HTTPS URL
      and that the production WP has Application Passwords disabled for the
      service account.
- [ ] Stripe webhook signature: replay the same event with a tampered body
      and confirm `403`; replay with a stale timestamp (>5 min) and confirm
      `400`.
- [ ] `inspect_page_license` cannot be set by an unprivileged user (REST or
      profile edit) — only the webhook + admins.

## 2. Privacy + Terms

- [x] `/privacy` page live (mirrors `store/privacy.md`).
- [x] `/terms` page live (new — see `src/pages/Terms.tsx`).
- [x] Footer links to both, no dead "Terms" placeholder.
- [ ] Confirm Chrome Web Store listing form uses the `/privacy` URL on
      production domain (not the preview URL).

## 3. Store assets

Specs in `store/screenshots.md`. Required deliverables in `store-assets/`:

- [ ] Icon set: 16, 32, 48, 128 px PNG (square, 8px safe area, no text on 16/32).
- [ ] Promo tile: 440 × 280 (small) — required.
- [ ] Marquee promo: 1400 × 560 — only needed if featured.
- [ ] Five screenshots, 1280 × 800 PNG:
    1. Hero — popup over a real page, "Smart Share" button visible.
    2. Export modes — the four-tab picker (MD single / MD+files / ZIP / Smart Share).
    3. Pick Element — picker overlay highlighting a card.
    4. Smart Share dialog — 4 URLs + countdown.
    5. WP plugin dashboard — sessions table.
- [ ] Listing copy reviewed against `store/listing.md`. No mention of
      "PagePort" / "LLM Export" anywhere (memory: brand rule).

## 4. Acceptance run

Walk through `docs/ACCEPTANCE-v2.2.md` end-to-end on the production WP with
a fresh Chrome profile. Check:

- [ ] Sign-in via bridge popup completes in <5s.
- [ ] All 4 export modes succeed on a complex page (e.g. `https://stripe.com`).
- [ ] 5th Smart Share returns 402 with the upgrade CTA.
- [ ] Admin grants license → 6th share succeeds + welcome email arrives.
- [ ] Cron deletes a 24h-old session; URLs return 404 immediately after.
- [ ] Front-end `[inspect_page_account]` page revokes correctly.
- [ ] `/privacy` and `/terms` render on landing.
- [ ] Pick Element inspector: identity, box-model, text props, selection
      colors + WCAG verdict, Code drawer tabs, and 4 export modes all
      render and copy correctly on a `<button>`, `<article>`, and an SVG.
- [ ] Picker keyboard nav (↑ parent / ↓ first child / ←→ siblings / Enter
      select) and Alt-held distance guides both work; mouse releases lock.

### AC-BILL — Stripe billing acceptance

- [ ] **AC-BILL-1** Free user clicks **Upgrade to Pro** in Settings →
      lands on Stripe Checkout in <3s; cancel returns to extension; success
      flips license to `active` within 5s of webhook delivery; quota row
      now reads "Pro — unlimited".
- [ ] **AC-BILL-2** Free user hits 5/5 quota; inline **Upgrade to Pro**
      CTA on the Smart Share error opens Checkout; same end-state as AC-1.
- [ ] **AC-BILL-3** Pro user clicks **Manage subscription** → Customer
      Portal opens; cancel-at-period-end stays Pro until period end; full
      cancel + `customer.subscription.deleted` flips license off; quota
      row reverts to "Free shares used: X / 5".
- [ ] **AC-BILL-4** `[inspect_page_pricing]` shortcode: shows "Current
      plan" badge on the right tier, "X of Y free Smart Shares used" hint
      for Free users, post-checkout success banner via
      `?inspect_page_upgraded=1`, and collapses to a single column at
      ≤640 px.
- [ ] **AC-BILL-5** `chrome://extensions` service-worker logs show the
      `Billing` category events: `UPGRADE_CLICKED`, `CHECKOUT_OPENED`,
      (`CHECKOUT_FAILED` on forced failure), `PORTAL_CLICKED`,
      `PORTAL_OPENED`, with the correct `surface` (`settings` vs
      `inline_quota_error`) in the props bag.

## 5. Submit

- [x] Bump `extension/manifest.json` + `extension/package.json` to `2.5.0`.
- [x] Bump `wp-plugin/inspect-page/inspect-page.php` to `2.4.0`.
- [x] `bash scripts/release.sh` → `public/inspect-page.zip` (extension)
      and `public/inspect-page-wp.zip` (WP plugin) regenerated with fresh
      `.sha256` files.
- [ ] Upload `inspect-page.zip` to Chrome Web Store dashboard; pick
      `store-assets/listing-2.5.0.md` for the listing copy.
- [ ] Refresh the WP plugin download link on the landing page to
      `inspect-page-wp.zip` (already in `public/`).
- [ ] Tag release `v2.5.0` and publish the CHANGELOG entry above.

## 6. Post-launch (out of scope, tracked here)

- Stripe Checkout subscription wiring (currently manual `wp user meta update`).
- Signed (HMAC) share URLs — current scheme is unguessable IDs only.
- Email digest of expired sessions.
- Picker-chip action-icon UX (deferred since v2.3.0 — no in-page chip yet).