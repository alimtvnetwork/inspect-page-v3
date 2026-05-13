
# Roadmap — Inspect Page (WordPress backend)

You decided: keep WordPress, rename everything from **PagePort → Inspect Page**, plan in phases, execute one phase per `next`.

Each phase ends in a working state you can install and test. Nothing below is built yet — say **next** when you want me to start Phase 1.

---

## Phase 1 — Full rebrand: PagePort → Inspect Page

**Goal:** Every visible and internal reference to "PagePort" becomes "Inspect Page" (or the appropriate slug variant). Functionality unchanged.

What I'll change:
- **User-visible copy** (extension UI, popup title, panel headings, toasts, landing page hero, docs, dashboard headings) → "Inspect Page".
- **File names**: `pageport.zip` → `inspect-page.zip`, `pageport-wp.zip` → `inspect-page-wp.zip`, plus `pageport-fullpage-…` / `pageport-element-…` download names.
- **Code identifiers** (lowercase slug `inspect-page`):
  - chrome storage key `pageport` → `inspect-page` (with one-time migration so existing users don't lose their session)
  - log prefix `[pageport]` → `[inspect-page]`
  - constant `PAGEPORT_WP_SITE_URL` → `INSPECT_PAGE_WP_SITE_URL`
  - WP plugin folder `wp-plugin/pageport/` → `wp-plugin/inspect-page/`
  - REST namespace `pageport/v1` → `inspect-page/v1`
  - WP option/meta keys (`pageport_license` → `inspect_page_license`, etc.) with a one-time migration on plugin activation so existing data is preserved.
- **Repackage** both zips, refresh SHA-256.
- **Manifest**: extension `name`, `short_name`, `description` updated.
- **Memory + docs** already updated.

End state: you re-download both zips, re-install the plugin (it auto-migrates old options), re-load the extension. Nothing breaks.

---

## Phase 2 — End-to-end smoke test of the existing flow

**Goal:** Prove the whole pipeline works on your live Hostinger WP before adding anything new.

Walkthrough I'll guide you through (and verify with logs/network inspection):
1. Sign in from extension → confirm cookie + nonce flow lands.
2. Export Page → 4 export modes all produce correct files.
3. Pick Element → same 4 modes work on a single element.
4. Smart Share × 5 → confirm 4 URLs returned, clipboard copy works, links open in fresh browser, expire countdown ticks.
5. 6th Smart Share → confirm `402 E_SHARE_QUOTA_FREE` toast: "You've used your 5 free shares. Upgrade coming soon."
6. From WP admin → set your user meta `inspect_page_license = active` → 6th share now succeeds.
7. Wait/force the hourly cron → confirm expired session files are deleted from `wp-content/uploads/inspect-page/<user>/<session>/`.

End state: documented "known good" baseline. Any bugs found here get patched before Phase 3.

---

## Phase 3 — Public landing page + signup story

**Goal:** A real person who has never heard of WordPress can install the extension and start using it in under 2 minutes.

What I'll build:
- **Landing page** (the existing `/` route in this Lovable app): hero, 3-step "how it works", feature grid, pricing section (Free 5 shares vs Pro $5/mo coming soon), download buttons for the extension zip + Chrome Web Store CTA (placeholder until published), FAQ, footer.
- **Signup walkthrough**: when extension's "Sign in" opens the WP login page, that page is themed lightly (custom logo + colors via a tiny mu-plugin) so it doesn't scream "WordPress". A "Create account" link is visible.
- **Optional Google sign-in**: I'll write instructions for you to install the free `Nextend Social Login` plugin on your WP, plus a 2-line code change so the extension's bridge accepts Google-auth'd users too. (Decision deferred — only do this if you say so.)
- **Onboarding tooltip** in the extension popup the first time it's launched: "Sign in to enable Smart Share."

End state: shareable landing URL, friendly first-run experience.

---

## Phase 4 — Payments: Stripe Checkout subscription ($5/mo unlimited)

**Goal:** Users can self-serve upgrade from Free → Pro, with no manual admin step.

Two sub-options for *how* — I'll ask you to pick at the start of this phase:

- **4a. Direct Stripe Checkout via the WP plugin** (recommended for one $5/mo plan)
  - Add `STRIPE_SECRET_KEY` + webhook secret to plugin settings page.
  - New REST routes: `POST /billing/checkout` (creates Stripe session, returns URL) and `POST /billing/webhook` (Stripe → flips `inspect_page_license` to `active` on success, removes it on cancellation/failure).
  - Extension shows "Upgrade to Pro" button in the quota banner; it opens the Stripe-hosted checkout in a new tab.
  - After payment, extension polls `/auth-status` and the badge flips to "Pro — unlimited".
  - ~200 lines of PHP + ~30 lines of TS. Lightweight.

- **4b. WooCommerce + WooCommerce Subscriptions**
  - Heavier (30+ DB tables, $199/yr for the Subscriptions add-on), but you get a full storefront, dunning, customer portal, coupons, tax rules, etc.
  - Recommended only if you plan to also sell other things later.

End state: end-to-end paid upgrade works in test mode; flip Stripe to live keys when ready.

---

## Phase 5 — Quota UX polish & user-facing dashboard

**Goal:** Users can see what they're using and manage it themselves.

What I'll add:
- **Mini dashboard** inside the extension popup: signed-in identity, free shares remaining, recent shares (last 10) with copy/revoke buttons, link to billing portal if Pro.
- **WP-side "My Inspect Page" page** (front-end shortcode on a published WP page, not wp-admin): same info plus account email management, cancel subscription button (Stripe billing portal link).
- **Email notifications** (via the WP plugin) on: 1st share created (welcome), 4th share (one share left), 5th share (free quota hit, upgrade CTA), Pro activation, Pro cancellation. Uses WP's built-in `wp_mail` so no extra service needed.
- **"Revoke now" button** in the extension's share dialog — already partially built; finish + wire it to delete files immediately.

End state: feature-complete v1 of Inspect Page that you can show off without footnotes.

---

## Phase 6 — Hardening & launch prep

**Goal:** Ready for Chrome Web Store submission and public traffic.

Checklist:
- Security pass: rate-limit headers, CORS lockdown, file-type sniffing on uploads, max upload size, signed-URL alternative for share files (so even the 43-char ID isn't enough — the URL itself includes a short-lived HMAC).
- Privacy: Privacy Policy + Terms pages on landing site (templates I'll generate, you review).
- Chrome Web Store assets: 128px icon (already have), 440×280 promo, 1280×800 screenshots, store description text.
- WP plugin hardening: nonces on every write, capability checks, escape all output, prepare all SQL.
- Backup + restore docs for your Hostinger WP.
- Analytics opt-in (Plausible or umami — privacy-friendly, no cookie banner needed).

End state: submit to Chrome Web Store, switch Stripe to live, open the floodgates.

---

## Open questions for later phases (no answer needed yet)

- Phase 3: do you want Google sign-in via Nextend, or just email/password?
- Phase 4: 4a (direct Stripe) or 4b (WooCommerce)?
- Phase 4: trial period? coupon codes? annual plan with discount?
- Phase 5: should "Pick Element" share mode include the parent page screenshot or only the element crop?
- Phase 6: which analytics tool (or none)?

---

Say **next** to start **Phase 1 — Full rebrand**.
