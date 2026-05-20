# Plan — Text Typography + Account sections in Inspect Mode

Goal: replicate the CSS Peeper "Typography" experience inside our Inspect panel — a per-element-kind list (Paragraph, Span, H1, H2, …) with instance count, an `AaBbCc…` preview rendered in the element's actual font/size/weight/color, a "Show details" drawer with full style breakdown + Locate, and a bottom Account section.

Current state: `InspectTypography.tsx` only shows 2 summary cards (Headings/Body) + a flat "Show all" modal. The snapshot's `fonts[]` is grouped by family, not by tag — so we don't yet have per-tag instances with their own sample text.

## Phase 1 — Snapshot model

Extend `extension-src/inspect/types.ts` and `collectSnapshot.ts`:
- New type `TypographyGroup` with: `tag` (`p`, `span`, `h1`…`h6`, `a`, `li`, `button`, `label`, `strong`, `em`, `small`, `blockquote`, `code`), `instances` (count), `fontFamily`, `fontStack`, `fontSizePx`, `fontWeight`, `lineHeightPx | "normal"`, `letterSpacing`, `color`, `sampleText` (first non-empty trimmed textContent, max 80 chars), `selectorPath` (first instance, for Locate).
- Collector walks visible elements once, groups by `(tag, fontFamily, fontSizePx, fontWeight, color)` so genuinely different uses of the same tag become separate cards (matches CSS Peeper).
- Bound: max 60 groups, max 8000 scanned elements (reuse existing budget).
- Add `typography: TypographyGroup[]` to `InspectSnapshot`.

## Phase 2 — UI: Text Typography section

Rewrite `InspectTypography.tsx` (or add `InspectTextTypography.tsx`) to render:
- Section header: "Text Typography" + count badge.
- Vertical list of cards. Each card:
  - Title: tag name (`Paragraph`, `Span`, `Heading 1`, …).
  - Sub: `N instance` / `N instances`.
  - Sample row: `AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp…` rendered with the group's actual `fontFamily / fontSize / fontWeight / color`, single-line, truncated with ellipsis.
  - Right-aligned Locate icon (reuses `locateElement(selectorPath)` from `inspect/locateColor.ts`) — flashes all matching elements.
  - "Show details ›" link → opens a drawer (reuse `DetailDrawer.tsx`) with: Font family, Size, Weight, Line height, Letter spacing, Color (with swatch + copy), Selector path (copy), Instance count, full sample paragraph.
- Mount it below `InspectInspector` in `InspectShell.tsx` (the user asked for it below Element Inspector).
- All styling uses existing dark-mint tokens in `panel/styles.css` (no new colors).

## Phase 3 — Account section (bottom of Inspect)

Add an "Account" card at the bottom of the Inspect scroll, above the footer:
- Signed out → "Sign in to Inspect Page" button → reuse existing WP sign-in bridge from Settings.
- Signed in → show: email (from `/billing/status`), plan badge (Free X/5 or Pro), "Manage subscription" + "Sign out".
- Pure UI wrapper around existing `getBillingStatus` / `startBillingPortal` / sign-out helpers — no new backend.

## Phase 4 — Tests + package

- Unit test for the new collector grouping logic (`__tests__/typographyGroups.test.ts`).
- Render test for `InspectTextTypography` (empty + populated).
- Bump version to `v2.7.26`, rebuild + repackage `public/inspect-page.zip`, refresh sha256, verify 194+ vitest still green.

## Execution rule

You said execute phase-by-phase on `next`. I'll run Phase 1 first when you say `next`, then wait for the next `next` before Phase 2, etc.

## Open questions (please confirm or I'll default)

1. Grouping key — group by `(tag + fontFamily + size + weight + color)` like CSS Peeper, or strictly by `tag` only (one card per tag)? **Default: CSS Peeper style (composite key).**
2. Tag whitelist above — OK, or include every tag containing text?
3. Account section — put it inside the Inspect tab as proposed, or as a new bottom-bar tab icon (like the avatar in the screenshot)? **Default: card at bottom of Inspect tab; we already have a Settings tab for the avatar slot.**

## Remaining launch tasks (unchanged)

1. [BLOCKER] Prod `INSPECT_PAGE_WP_SITE_URL`
2. Stripe live keys
3. Pen-test pass
4. Acceptance runs (AC-BILL / AC-ANALYTICS / AC-UI-259 / AC-WS)
5. Re-shoot CWS screenshots
6. Upload latest zip to Chrome Web Store
7. Git tags `ext-vX.Y.Z` + `wp-v2.6.0`
8. 24h post-launch watch
