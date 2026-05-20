# Acceptance criteria — static walkthrough (v2.7.0 / ext v2.7.26)

Date: 2026-05-20. Auditor: Lovable agent. Live re-test blocked on `INSPECT_PAGE_WP_SITE_URL`.

Legend: `[x]` static-pass (code/test verified) · `[~]` requires live env · `[ ]` fail / gap.

## AC-BILL — Stripe billing (5)

- [x] **AC-BILL-1** Upgrade flow wired: `startBillingCheckout()` → `/billing/checkout` → Stripe Checkout URL. Webhook `checkout.session.completed` → `activate()` → `inspect_page_license=active`. Code: `class-billing.php:236-238`.
- [~] **AC-BILL-2** Quota-error inline CTA path exists in `ExportPanel.tsx` (Smart Share error → Upgrade button). Round-trip needs live Stripe.
- [x] **AC-BILL-3** Portal route `/billing/portal` returns customer-portal URL; cancel events `customer.subscription.deleted` → `deactivate()` (`class-billing.php:244-246`). Quota row recompute is automatic on next `/billing/status`.
- [~] **AC-BILL-4** Shortcode `[inspect_page_pricing]` defined in `class-shortcode.php`; visual + responsive collapse needs live render.
- [~] **AC-BILL-5** Background analytics events defined in `extension-src/background.ts` (`UPGRADE_CLICKED`, `CHECKOUT_OPENED`, etc.); requires live SW log inspection.

## AC-ANALYTICS — Share-link analytics (3)

- [x] **AC-ANALYTICS-1** `InspectPage_Stats::record_view()` invoked from `read_asset()` (`class-rest.php:333`); per-kind counters in `wp_pp_session_views`.
- [~] **AC-ANALYTICS-2** Recent-visitors drawer wired in admin Sessions page (Pro-gated). Live UI test required.
- [x] **AC-ANALYTICS-3** Visitor inserts gated by `inspect_page_license=active` check before writing `wp_pp_visitors`. Free users → no rows.

## AC-UI-259 — Popup UX (3)

- [x] **AC-UI-259-1** Settings overlay covers full popup body (CSS `.lpe-settings-overlay { inset: 0 }`); ESC handler in `panel/SettingsOverlay.tsx`; single-chevron `<select>` styled via `appearance: none` + custom SVG.
- [x] **AC-UI-259-2** Inspect tab shimmer skeleton (`InspectShell.tsx`) paints synchronously; snapshot cached in module-scope map; ↻ button calls `collectSnapshot()` fresh.
- [x] **AC-UI-259-3** Signed-out onboarding `Sign in` + `Share Links` both call `openBridgeTab()` directly (no Settings detour); status string matches spec.

## AC-WS — Team Workspaces (7)

See `docs/AC-WS-SPEC.md` for full definitions.

- [x] **AC-WS-1** Activator backfill + license copy in `class-activator.php:184`; idempotent on re-run.
- [x] **AC-WS-2** `POST /workspaces` route + `WorkspacePicker.tsx` create path.
- [x] **AC-WS-3** Invite CRUD + `wp_mail()` + `inspect-page-accept` admin page.
- [x] **AC-WS-4** TTL + single-use enforced in accept handler.
- [x] **AC-WS-5** Membership gate on `/workspaces/{id}/sessions` → 403.
- [x] **AC-WS-6** Quota gate reads workspace `license_status` first; PHP test covers inheritance.
- [x] **AC-WS-7** Owner-only transfer route; atomic role swap; PHP test covers single-owner invariant.

## Summary

- Static pass: **14 / 18**
- Live re-test required: **4** (AC-BILL-2, BILL-4, BILL-5, ANALYTICS-2)
- Failures: **0**

## Next live actions (post prod URL)

1. `bash scripts/smoke-runbook.sh` — exercises BILL-1/3 + ANALYTICS-1/3 + WS-1..7 end-to-end.
2. Manual: open `[inspect_page_pricing]` page → resize to 640px (BILL-4).
3. Manual: trigger Upgrade from popup + from inline-quota-error → grep SW logs for the 5 event names (BILL-5).
4. Manual: Pro account, toggle Recent visitors, hit asset, confirm drawer row (ANALYTICS-2).