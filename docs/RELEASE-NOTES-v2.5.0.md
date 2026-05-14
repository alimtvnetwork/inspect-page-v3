# Release notes — Inspect Page v2.5.0

_Released 14 May 2026 · Extension `2.5.0` · WP plugin `2.4.0`_

## Highlights

**Pick Element grew up.** A right-click on any element now opens a rich,
devtools-style inspector docked in the side panel — identity, box-model,
text properties, selection colors with WCAG contrast verdict, and a code
drawer that shows matched CSS by pseudo-state plus computed-style
overrides grouped by category. The same four export modes (MD single,
MD + files, ZIP, Smart Share) are docked under the inspector so a single
element ships the same AI-ready bundle as a full-page export.

**Picker overlay now has rulers, distance guides, and keyboard nav.**
Margin (orange) and padding (green) rulers with per-side px badges, a
`W × H` size chip, **Alt-held** dashed distance guides to the viewport
edges, and arrow-key DOM walking (↑ parent, ↓ first child, ←→ siblings,
Enter to select). Move the mouse to release the keyboard lock.

**Pricing page polish.** The `[inspect_page_pricing]` shortcode now
collapses to one column on mobile, highlights the visitor's current
plan, shows a "X of Y free Smart Shares used" hint for Free users, and
greets returning Pro users with a success banner after Stripe Checkout.

**Billing telemetry.** Upgrade and Customer Portal click flows now log
structured `Billing` events (`upgrade_clicked`, `checkout_opened`,
`checkout_failed`, `portal_clicked`, `portal_opened`, `portal_failed`)
visible in the extension service-worker logs — surface (`settings` vs
`inline_quota_error`) and failure reason are captured for debugging.

## Full changelog
See [`CHANGELOG.md`](../CHANGELOG.md#extension-250--2026-05-14).

## Upgrade notes

- Existing Smart Share sessions and licenses are unchanged.
- WP plugin 2.4.0 is a drop-in replacement; no DB migration runs.
- The new "Pick Element" inspector requires the side panel — chrome
  versions older than 114 should pin to extension 2.4.x.

## Known issues

- The picker chip "action icons" UX (in-page floating buttons next to
  the highlighted element) is still deferred. The inspector lives in
  the side panel for now.