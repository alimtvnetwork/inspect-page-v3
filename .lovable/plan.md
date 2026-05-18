
# Plan — "Blueprint" visual refresh

Goal: every feature, button, card, and section across the three surfaces (marketing site, Chrome extension, WP plugin admin) adopts the look of the uploaded reference — crisp white background, vivid royal-blue accents, soft light-blue fills, generous rounded corners, floating circle decorations, and clean geometric wireframe energy.

Reference image: bright blue `#2F6BFF` primary, light blue `#DCE7FF` fills, near-white `#F5F7FA` background, charcoal `#1A1A1A` text, large pill buttons in solid blue, rounded 16–20px cards with soft drop shadows, decorative blue circles bleeding off-canvas.

## 1. New design tokens (one source of truth)

Replace the current mint/cyan token set with a "Blueprint" palette in `src/index.css`, `tailwind.config.ts`, **and** `extension-src/panel/styles.css`. All HSL.

```text
--background:        0 0% 98%        // #FAFBFC
--foreground:        222 15% 12%     // near-black text
--card:              0 0% 100%       // pure white cards
--muted:             220 30% 96%     // light blue-tint surface
--primary:           221 100% 59%    // #2F6BFF royal blue
--primary-foreground:0 0% 100%
--accent:            221 100% 92%    // #DCE7FF soft blue fill
--accent-foreground: 221 80% 30%
--ring:              221 100% 59%
--border:            220 20% 90%
--radius:            1rem             // 16px default, pill buttons = 9999px
--shadow-blueprint:  0 18px 40px -20px hsl(221 100% 59% / 0.25)
--gradient-blueprint:linear-gradient(135deg, hsl(221 100% 59%), hsl(221 100% 70%))
```

Dark mode kept but recoloured (deep navy `#0B1530` bg, same blue primary).

## 2. Component variants

Update `src/components/ui/button.tsx` with new variants used everywhere:
- `blueprint` — solid blue pill, white text, soft blue glow shadow on hover, `rounded-full px-6`.
- `blueprintGhost` — transparent with blue text + blue underline on hover.
- `blueprintOutline` — 1.5px blue border, blue text, light-blue fill on hover.

Card primitive gets a `blueprint` variant: white, `rounded-2xl`, 1px `border-border`, `shadow-blueprint`, optional decorative blue circle in corner.

Add a reusable `<BlueprintBackdrop />` (absolute-positioned blue circles of varying sizes/opacities, behind hero and major sections) — mirrors the floating circles in the reference.

## 3. Marketing site (`src/components/landing/*` + `src/pages/*`)

Repaint every section to the new tokens. No layout rewrites — just swap colors, radii, button variants, and add the backdrop circles to Hero, Pricing, WpPlugin, InstallSteps.

Files: `Hero.tsx`, `WhatYouGet.tsx`, `HowItWorks.tsx`, `InstallSteps.tsx`, `Pricing.tsx`, `WpPlugin.tsx`, `Faq.tsx`, `Privacy.tsx`, `Footer.tsx`, `WhatsNew.tsx`, `NavLink.tsx`, `pages/Index.tsx`, `pages/Privacy.tsx`, `pages/Terms.tsx`, `pages/NotFound.tsx`.

Concretely:
- Hero: white bg, two floating blue circles bleeding off corners, h1 in charcoal, primary CTA = `blueprint` pill, secondary = `blueprintOutline`.
- Section cards everywhere → white `rounded-2xl` w/ blue accent badge.
- Pricing: featured tier wrapped in `gradient-blueprint` border, "Upgrade" CTA = `blueprint` pill.
- Icons recolored to primary blue.

## 4. Extension popup + floating panel (`extension-src/panel/*`, `extension-src/popup/*`)

Replace the mint/cyan theme in `extension-src/panel/styles.css` with the Blueprint tokens. Popup `index.html` background and `#root` get the white bg + subtle blue radial backdrop.

Touch points:
- `ExportPanel.tsx`, `ExportModes.tsx`, all `panel/inspect/*` components, `element/ElementInspector.tsx`, `element/CodeDrawer.tsx`, `BillingPanel`, `RecentShares`, settings rows.
- Every `.lpe-btn` → blue pill style, primary action blue, secondary outline.
- Recent Shares thumbnails get blue 1px border + rounded-xl frame matching reference.
- Status chips: light-blue fill, blue text.
- Drag header: white with blue title text and blue minimize/close icons.

Memory rule update: popup theme is no longer "neon mint" — note the swap and update the memory index after sign-off.

## 5. WP plugin admin (`wp-plugin/inspect-page/includes/class-admin.php`)

The admin page renders its own CSS. Repaint:
- Header banner: white card with blue title + blue icon, decorative circle SVG top-right.
- Tabs: blue underline for active, gray for inactive.
- Status pills (REST OK / Permalinks OK / Pro / Free): light-blue fills, blue text, blue dot.
- Buttons: WP `button-primary` overridden to royal blue pill `#2F6BFF`; secondary → outlined blue.
- Sessions table rows: white, hover light-blue, thumbnail column 36×36 rounded-md with blue border.

## 6. QA + packaging

1. `bunx vitest run` — must stay 194/194.
2. Visually walk: landing route `/`, popup (open extension), floating panel (Mount on page), WP admin dashboard + Sessions tab.
3. Repackage `public/inspect-page.zip` and `public/inspect-page-wp.zip` + refresh `.sha256`.
4. Update `docs/RELEASE-NOTES-v2.6.3.md` (extension) + `wp v2.5.6` covering the visual refresh only.
5. Update memory index: theme swap from mint → Blueprint blue.

## Technical notes

- No business logic changes — purely CSS, token, and JSX className edits.
- Zero new dependencies.
- All colors via tokens; no raw hex in components (per project rule).
- Reuse existing component primitives; add variants instead of new components where possible.
- Extension Shadow DOM panel must duplicate the token CSS vars inside its `<style>` because it can't read site-level CSS.

## Phases (executable on `next`)

- **Phase A** — Tokens + button/card variants + `<BlueprintBackdrop />` (foundation, no visual breakage).
- **Phase B** — Repaint marketing site sections.
- **Phase C** — Repaint extension popup + floating panel + all inspect sub-panels.
- **Phase D** — Repaint WP plugin admin CSS.
- **Phase E** — QA, repackage zips, release notes, memory update.

## Remaining (carry-over from prior work)

1. ⏳ Bake prod `INSPECT_PAGE_WP_SITE_URL` (needs URL)
2. Stripe live keys + price + webhook secret
3. AC-BILL-1…5, AC-ANALYTICS, AC-UI-259 manual QA
4. Pen-tests
5. Chrome Web Store upload
6. Git tags `ext-v2.6.2` + `wp-v2.5.5`
7. Re-shoot Chrome Web Store screenshots (now in Blueprint theme, after this refresh)
8. Deferred: Team workspaces (plan already drafted)

Reply `next` to execute Phase A.
