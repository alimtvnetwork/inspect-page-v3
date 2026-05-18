# Inspect Page Extension v2.6.2 + WP plugin v2.5.5

## New
- **Dynamic Pro pricing.** The "Upgrade to Pro" tagline in the extension's
  Billing panel now reflects the actual Stripe price configured on the WP
  site instead of a hard-coded "$5 / month".
  - WP plugin (`/billing/status`) calls Stripe `prices.retrieve` once and
    caches the result in a 12 h transient. Response now includes
    `price: { id, unit_amount, currency, interval, nickname }`.
  - Extension (`getBillingStatus`) parses the new field and the new helper
    `formatBillingPriceTagline` renders it with `Intl.NumberFormat`
    (e.g. `"$5 / month — unlimited Smart Shares"`,
    `"€49,99 / year — unlimited Smart Shares"`).
  - Falls back gracefully to the static `$5 / month` copy when the WP
    plugin is older than 2.5.5, Stripe is unreachable, or the price has
    no `unit_amount` / `currency`.

## Popup redesign
- Popup is now a **600 × 600 square** (phone-like) with a radial mint
  vignette over a `#0B0F0E` background.
- New token palette: mint `#2DD4A8` → glow `#73FFB8`, cyan `#5CE1E6`
  accents, text `#F5FFFA` / muted `#94A3B8`.
- Primary buttons use a `linear-gradient(135deg, #2DD4A8, #73FFB8)` with
  a soft mint outer glow. All grey/blue `--lpe-*` tokens were replaced so
  every section inherits the new theme — no per-component overrides.

## Tests
- New `formatPrice.test.ts` covers fallback, USD whole-dollar, EUR
  yearly with decimals, missing fields, and custom fallback override.
- Full suite: **194 / 194 vitest green**.

## Packaging
- `public/inspect-page.zip` + `.sha256` repackaged at v2.6.2.
- `public/inspect-page-wp.zip` + `.sha256` repackaged at v2.5.5.

## Manual launch checklist (still pending)
- Set `INSPECT_PAGE_WP_SITE_URL` in `extension-src/shared/constants.ts`
  to the production WordPress URL.
- Swap Stripe to live keys + price + webhook secret.
- Walk AC-BILL-1…5, AC-ANALYTICS, AC-UI-259.
- Pen-tests.
- Chrome Web Store upload (re-shoot screenshots with the new mint theme).
- Tag `ext-v2.6.2` and `wp-v2.5.5`.