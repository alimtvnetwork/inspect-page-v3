=== Inspect Page ===
Contributors: inspect-page
Tags: ai, share, export
Requires at least: 5.6
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 2.4.0
License: MIT

Backend for the Inspect Page Chrome extension. Hosts captured HTML / CSS / JS / image bundles for 24 hours behind public URLs so an LLM can read them.

== Description ==
Install and activate the plugin, then in the Inspect Page extension open Settings → Smart Share (WordPress), enter your site URL and click **Sign in**. A WordPress login tab opens; sign in as usual and the extension picks up your cookie + REST nonce automatically — no tokens, no application passwords. The "Smart Share" export mode then uploads your captured HTML / CSS / JS / screenshot to your own site and returns four public URLs (plus an AI instruction block you can paste into ChatGPT, Claude, or Gemini). Each WordPress user is capped at 30 active sessions and 60 uploads per hour; individual share links expire after 24 hours.

== Shortcodes ==
* `[inspect_page_account]` — front-end "My Inspect Page" panel: display name, license status, lifetime quota, and the user's last 20 Smart Share sessions with revoke buttons. Logged-out visitors see a Log in link.
* `[inspect_page_pricing]` — Free vs Pro comparison card. Logged-in users get a one-click **Upgrade to Pro** button (or **Manage subscription** for Pro users) that opens Stripe-hosted Checkout / Customer Portal via the plugin's `/billing/checkout` and `/billing/portal` REST endpoints. Requires Stripe to be configured in WP Admin → Inspect Page → Billing.

== Changelog ==
= 2.4.0 =
* Pricing shortcode polish: responsive 2-col grid that collapses on mobile, ✓-style feature checks, "Current plan" highlight for Free / Pro users, "You have used X of Y free Smart Shares" hint for Free users, post-checkout success banner via `?inspect_page_upgraded=1`, and richer Free-tier feature list (Pick Element inspector, distance guides, keyboard nav).

= 2.3.0 =
* Stripe Checkout + Customer Portal wired end-to-end. New REST routes `/billing/checkout`, `/billing/portal`, `/billing/webhook`, `/billing/status`. Webhook is signature-verified (manual `v1=` HMAC, no Stripe SDK required) and flips `inspect_page_license` to `active` automatically on `checkout.session.completed` / `invoice.paid` and clears it on `customer.subscription.deleted` / `invoice.payment_failed`.
* WP Admin → Inspect Page → Billing section: paste Stripe secret / price ID / webhook secret, see configured status, and copy the webhook endpoint URL.
* New `[inspect_page_pricing]` shortcode for marketing pages.
* Lifetime free-share quota: each WordPress user gets 5 Smart Share uploads for free (option `inspect_page_free_lifetime_limit`). Beyond that, `POST /sessions` returns `402 E_SHARE_QUOTA_FREE` until the user holds an active Inspect Page license.
* License flag is the user meta `inspect_page_license` (set to `active` to grant Pro). Admins can also flip this manually for comp accounts.
* `GET /auth-status` now also returns `lifetime_used`, `free_limit`, `has_license` so the extension can show "Free shares used: X / 5" or "Pro — unlimited".

= 2.2.1 =
* Plugin row "Visit plugin site" now opens the in-WP Inspect Page dashboard instead of an external URL.
* New Inspect Page dashboard (WP Admin → Inspect Page): account info, extension pairing instructions, REST/permalinks health check, live quota counters (active sessions + uploads/hour), and recent share sessions with all 4 public URLs.
* Tools → Inspect Page Sessions: added JS column, expiry countdown, and friendly empty state.

= 2.2.0 =
* Authentication switched from Inspect Page pairing tokens to standard WordPress cookie + `X-WP-Nonce` (no shared secrets, no token paste).
* Smart Share now uploads four files (HTML / CSS / **JS** / screenshot) and serves them at `/share/{id}/index.html | style.css | script.js | preview.png`.
* Per-user quotas: 30 active sessions, 60 uploads / hour (`pp_rate_events`).
* `GET /auth-status` returns the signed-in user, fresh nonce, and current quota.
* Hidden `inspect-page-bridge` admin page used by the extension login popup to forward the `wp_rest` nonce via `postMessage`.

= 2.0.0 =
* Inspect Page pairing-token auth (`PPT1.<payload>.<hmac>`) replaces WordPress Application Passwords.
* Tools → Inspect Page admin UI: mint, list, and revoke pairing tokens.
* `POST/GET/DELETE /sessions`, `GET /share/{id}/{html|css|image}`, and `DELETE /pairing/self` REST routes.
* Per-token quota of 30 active sessions; share links expire after 24h.

= 0.1.0 =
* V4 scaffold: tables, REST routes (501 stubs), hourly cron registration.
