
# Plan — Wireframe "Blueprint" style for the extension (mint-themed)

Scope: only the **Chrome extension surfaces** (toolbar popup + injected floating panel + Inspect sub-panels). The marketing site and WP admin are out of scope. Keep the current mint/cyan brand color — only borrow the *visual language* of the reference image: clean light surface, soft-tint card fills, crisp rounded geometry, pill buttons, and decorative floating circles in the brand accent.

## 1. Visual language we are adopting

From the reference, independent of color:
- Bright, near-white surface with subtle off-white background gutter.
- White cards floating with soft drop shadow, ~16–20 px rounded corners.
- Soft-tint accent fills for content blocks (image placeholders, status pills, inputs).
- Solid, full-bleed pill buttons at the bottom of cards.
- Thin 1px borders on inputs/cards; inputs have a 2px accent border when focused.
- Decorative circle motifs (varied sizes, varied opacity) bleeding off the canvas edges.
- Plenty of whitespace; clear vertical rhythm; small monochrome icons paired with short labels.

## 2. Color mapping (keep mint identity)

Translate "blue" in the reference → existing mint tokens. **No new brand color.**

- Reference royal blue (solid CTAs, decorative circles, focus ring) → `--ext-mint #2DD4A8`.
- Reference soft pale-blue fills (image blocks, status chips) → `--ext-mint-soft` = mint @ 14% alpha on white.
- Reference white card → `--ext-card #FFFFFF`.
- Reference background gutter → `--ext-bg #F5F7F6` (cool near-white with a hint of mint).
- Reference charcoal text → `--ext-fg #111714`.
- Reference muted gray text → `--ext-muted #5B6B66`.
- Subtle hairline border → `--ext-border #E4ECE9`.

This swaps the current dark mint popup (bg `#0B0F0E`, glow `#73FFB8`) for a **light mint-on-white** scheme that mirrors the reference layout but stays on-brand.

## 3. Component primitives (extension only)

All in `extension-src/panel/styles.css` (Shadow-DOM-scoped). No new dependencies.

- `.lpe-surface` — page background `--ext-bg`, applied to popup body and floating panel root.
- `.lpe-card` — white, `border-radius: 18px`, `box-shadow: 0 12px 28px -16px rgba(17,23,20,.18)`, 1px border `--ext-border`, internal padding 16–20px.
- `.lpe-pill-btn` — full-width pill, mint fill, white text, 44px tall, 999px radius, subtle inner highlight on hover, mint glow shadow on focus.
- `.lpe-pill-btn--ghost` — transparent, mint text, 1.5px mint border, light-mint fill on hover.
- `.lpe-chip` — mint-soft fill, mint text, 999px, 12px font, 4×10 padding (used for status, "Pro", "Free X / 5", export-mode tags).
- `.lpe-input` — white, 1px hairline border, 12px radius, 2px mint border on focus, no inner shadow.
- `.lpe-thumb` — 36×36 rounded-md frame with mint-soft fill placeholder for missing previews; existing Recent Shares thumbnails get the same frame.
- `.lpe-decor` — absolutely positioned mint circles (4 variants: 12px, 28px, 64px, 120px) used as decorative motif behind headers; `pointer-events: none`, layered with low opacity so they never compete with content.
- Section dividers replaced with 8px vertical spacing + soft mint-soft separators where needed.

## 4. Surfaces to repaint

### A. Popup (`extension-src/popup/index.html` + `extension-src/popup/main.tsx`)
- Body bg → `--ext-bg`; `#root` becomes a single rounded "phone" card with the new motif: small decorative circles in the top-right corner (mirrors the reference), header strip with mint dot + "Inspect Page" wordmark, then stacked `.lpe-card` blocks: Export modes, Settings, Recent Shares, Billing.
- 600×600 size kept.

### B. Floating in-page panel (`extension-src/panel/mountFloatingPanel.tsx` + `styles.css`)
- Same surface tokens but tighter (320px wide). Header drag handle becomes a white pill with mint grip icon. Minimize/Close become small mint circular buttons.
- Cards inside the panel use the same `.lpe-card` style.

### C. `ExportPanel.tsx` + `ExportModes.tsx`
- Each export mode (MD / MD+files / ZIP / Smart Share) → its own `.lpe-card` with: mint-soft tinted icon square (mirrors the reference's image placeholders), title, one-line description, full-width `.lpe-pill-btn` at the bottom.
- Status row → `.lpe-chip` (mint-soft) with progress bar styled as a thin mint pill track.

### D. Inspect sub-panels (`extension-src/panel/inspect/*`)
- `InspectShell` header → white card row with mint export icon + retry icon as small circular ghost buttons.
- `InspectOverview`, `InspectTypography`, `InspectColors`, `InspectContrast`, `InspectCssInfo`, `InspectInspector` → each becomes a stacked `.lpe-card`. Color swatches keep their actual color but sit inside a `.lpe-thumb` frame with a hairline border.
- Drawers (`DetailDrawer`, `ShowCodeDrawer`, `CodeDrawer`) → white panels with the same rounded-top + close pill.

### E. Element inspector (`extension-src/panel/element/*`)
- Same card + pill-button treatment. Code blocks get a `.lpe-card` with a mint-soft header bar carrying "HTML" / "CSS" labels and a "Copy" `.lpe-pill-btn--ghost`.

### F. Billing + Recent Shares
- `BillingPanel`: white card; "Upgrade to Pro" → `.lpe-pill-btn` mint; "Manage subscription" → `.lpe-pill-btn--ghost`; price tagline rendered as small muted line; status indicator → `.lpe-chip`.
- Recent Shares rows: white row, 36×36 `.lpe-thumb`, mint `👁 N` chip, action icons as circular ghost buttons.

## 5. Decorative motif rules

- Top-right of the popup header: cluster of 3 mint circles (24px @ 100%, 12px @ 80%, 48px @ 12% opacity, bleeding off-edge).
- Bottom-left of the popup footer: single 80px mint circle @ 8% opacity, bleeding off-edge.
- Floating panel header: a single 16px mint circle behind the title.
- Never overlap interactive controls; all `pointer-events: none`.
- Respects `prefers-reduced-motion` (no animation — they are static).

## 6. Accessibility + behavior

- Contrast: mint text on mint-soft fill fails AA, so chips use mint text on white or charcoal text on mint-soft (verified visually + with a contrast helper).
- Focus rings: 2px solid mint, 2px offset.
- Reduced motion: no entrance animations on cards.
- No layout changes — only color, radius, padding, shadow, and the decorative motif. Every existing button/region keeps its role and ARIA label.

## 7. Out of scope

- Marketing site (`src/**`) — untouched.
- WP plugin admin — untouched.
- Brand color change — staying mint.
- Logic, REST contracts, message contracts — untouched.
- Dark mode popup theme — removed (reference is light); we keep one light theme only.

## 8. Phases (execute one per `next`)

- **Phase A** — Add the new token block + primitive classes (`.lpe-card`, `.lpe-pill-btn`, `.lpe-chip`, `.lpe-input`, `.lpe-thumb`, `.lpe-decor`) to `extension-src/panel/styles.css`. Update popup `index.html` body + `#root` to use `--ext-bg`. No JSX changes yet — existing components keep working with the legacy classes.
- **Phase B** — Repaint `ExportPanel.tsx` + `ExportModes.tsx` + Settings + Billing + Recent Shares to use the new primitive classes. Add decorative circles to popup root.
- **Phase C** — Repaint all `extension-src/panel/inspect/*` components and drawers.
- **Phase D** — Repaint `extension-src/panel/element/*` (ElementInspector, CodeDrawer).
- **Phase E** — Repaint floating panel chrome (`mountFloatingPanel.tsx` header/min/close + drag handle).
- **Phase F** — QA: `bunx vitest run` (must stay 194/194), visually walk popup + floating panel + every inspect tab + element inspector, repackage `public/inspect-page.zip` + `.sha256`, write `docs/RELEASE-NOTES-v2.6.3.md` (extension only — WP plugin unchanged), update the memory rule from "neon mint dark popup" → "Blueprint-style light-mint popup".

## 9. Technical notes

- Shadow DOM means the panel cannot inherit site CSS, so every token + primitive must live inside `styles.css` and be re-applied by `mountFloatingPanel.tsx`.
- Popup `index.html` can keep its inline style block; tokens are duplicated there for first-paint correctness.
- Keep existing `lpe-*` class names where used by tests; add the new primitive classes as additive utility classes on the same elements (no test breakage).
- No bundle size growth beyond ~2 KB of CSS.

## Remaining tasks (carry-over)

1. ⏳ Bake prod `INSPECT_PAGE_WP_SITE_URL` (needs URL)
2. Stripe live keys + price + webhook secret
3. AC-BILL-1…5 + AC-ANALYTICS + AC-UI-259 manual walk
4. Pen-tests
5. Chrome Web Store upload
6. Git tags `ext-v2.6.3` + `wp-v2.5.5`
7. Re-shoot CWS screenshots in the new Blueprint-mint look (after this refresh ships)
8. Deferred: Team Workspaces (plan already drafted, awaiting `next`)

Reply `next` to execute Phase A.
