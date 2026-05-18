## Goal

Redesign the extension popup (`ExportPanel` in `popup` surface) to match the reference visual language — clean white card, sectioned layout with `#F9FAFB` panels, `#E5E7EB` borders, `#1F2937` / `#6B7280` text, blue-accent active states, pill toggle group, footer toggles — while preserving every existing feature.

## Scope (visual only)

- Only touch `extension-src/panel/styles.css`, `extension-src/popup/index.html`, and the popup-surface render branches of `extension-src/panel/ExportPanel.tsx`. No business logic, no message contracts, no telemetry changes.
- Floating in-page panel (`surface="floating"`) keeps its current chrome — out of scope.

## Width / chrome

- Popup container: `640px × 640px` (was 600×600), white bg, 16px outer padding, rounded 14px sections, 1px `#E5E7EB` borders. Update both `popup/index.html` sizes and `styles.css` `.panel--popup` rules.

## Top tab bar (replaces today's "Inspect / Export / Pick" header buttons)

Two tabs, equal width, divided by a 1px rule:

- **Capture** (was Inspect) — camera icon, dark gray, light-gray inactive bg.
- **Record** (was Export) — currently active by default, filled black icon, white bg, bold.
Keep underlying state keys (`inspect` / `export`) — only labels + styling change. "Pick Element" stays a primary action under Capture.

## Sections (Record tab — primary view)

Stacked, each = labeled card with `#F9FAFB` bg, `#E5E7EB` border, 18px padding:

1. **Export Source** — 2×2 grid of cards (Full Page, Element, Selection, Visible Area). Each card: icon top-left, bold label, status dot (green = ready, gray = needs picker). Active card: blue left border + soft blue tint.
2. **Share Mode** — 2×2 grid (MD Single, MD + Files, ZIP, Smart Share). Same icon-label-dot pattern.
3. **Quality / Format** — single-row pill toggle: `MD`, `MD+Files`, `ZIP`, `Smart Share`, `Auto`. Active pill: black bg, white text, rounded full. Inactive: transparent, gray border. (Reuses existing format selector state.)
4. **Workspace** — 2-column grid of workspace cards (active workspace = blue left border). "Manage workspaces" link bottom-right.
5. **Action row** — two equal buttons:
  - Left: **Cancel / Stop** (red `#DC2626`, white text, square icon) — visible during in-progress export, otherwise hidden.
  - Right: **Start Export** (black bg, white text, play triangle).
6. **Footer toggles** — compact 13–14px row with two switches:
  - "Open share link after export" (red off / green on)
  - "Show preview before download"
   Backed by existing settings keys; no new persistence.

## Capture tab

Same visual grammar reused:

- **Pick Element** primary card (active blue border when picker is armed).
- **Inspector mode** toggle group (Element / Color / Spacing) as pill row.
- **Recent inspections** list reused unchanged inside a section card.

## Status / billing

- Quota readout ("Free shares 3 / 5" or "Pro · unlimited") moved to a slim chip above the action row, not its own section.
- Error / success banners reuse existing copy but restyled as a top sticky strip with the new tokens.

## Tokens (added to `styles.css`, scoped to `.panel--popup`)

```
--ip-bg: #FFFFFF;
--ip-section-bg: #F9FAFB;
--ip-border: #E5E7EB;
--ip-text: #1F2937;
--ip-text-muted: #6B7280;
--ip-accent: #2563EB;
--ip-accent-soft: #EFF6FF;
--ip-danger: #DC2626;
--ip-success: #16A34A;
--ip-radius: 14px;
```

Floating panel keeps its existing tokens.

## Out of scope

- Workspace switcher modal redesign (already shipped).
- Floating-panel chrome, content-script overlays, picker chip.
- Any change to message contracts, REST calls, share-link logic, or settings keys.
- Renaming the product or REST namespace (memory rule: stays "Inspect Page").

## Acceptance

- All 201 vitest specs still green (no logic touched).
- Popup at 640×640 renders without scroll on the default Record tab in idle state.
- Every existing action reachable; nothing removed, only restyled / regrouped.
- New tokens only used inside `.panel--popup` scope so floating panel is unaffected.

Reply `go` to implement, or tell me which sections to drop / rename.  
  
if after the output i dont like it, and if i say to revert then you have to revart back in current from

  
