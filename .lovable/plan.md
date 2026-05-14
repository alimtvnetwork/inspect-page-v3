## Goal

Make the panel feel as polished as CSS Peeper. First view = only the three tabs + the active tab's primary action. Settings hides behind the ≡ icon (top-left). Smart Share becomes a secondary action button inside Export and Pick tabs (not Inspect). Minimize / pop-out / close buttons must actually work. Refresh the dark color palette so contrast and depth read cleanly.

## Phases (atomic — execute one per `next`)

### Phase 1 — Strip the first view down to 3 tabs + primary action
- Remove the always-visible **Idle** status block, the **Settings** disclosure, and the **Smart Share** disclosure from the default Export/Pick view.
- Status text only renders when `status !== Idle` (busy / success / error).
- No layout shift when status appears (reserve space via min-height, not by always rendering "Idle").
- Acceptance: opening the popup shows header + tabs + one big primary CTA. Nothing else.

### Phase 2 — Convert ≡ into a real Settings menu button
- Replace the decorative `≡` span (left of "Inspect Page") with a `<button>` that opens a Settings popover/sheet.
- Move the entire current Settings panel content into that popover (image format, JPEG quality, redact, computed/matched, filenames, reset).
- Keep keyboard support: Esc closes; focus returns to the ≡ button.
- Remove the inline `▸ Settings` disclosure entirely.
- Acceptance: ≡ icon toggles a settings panel; old inline settings section is gone.

### Phase 3 — Smart Share becomes a per-tab secondary button
- Remove the standalone `▸ Smart Share` disclosure from the body.
- In **Export** tab: render `[ Export Full Page ]` (primary) + `[ Smart Share ]` (secondary) stacked.
- In **Pick** tab: render `[ Pick Element ]` (primary) + `[ Smart Share ]` (secondary) stacked.
- In **Inspect** tab: no Smart Share button.
- Smart Share button behavior:
  - If user not signed in → button shows "Sign in to share" and opens the WP sign-in flow (existing handler).
  - If signed in but no artifacts yet → tooltip "Run export first" and disabled state.
  - If signed in and artifacts present → triggers `onShare` and opens existing Share dialog.
- Acceptance: Smart Share is reachable from both Export and Pick, never from Inspect, and the old standalone section is gone.

### Phase 4 — Make header action buttons actually work
- Audit `onPopOut`, `onMinimize`, `onClose` wiring in `mountFloatingPanel.tsx` and the popup entry.
- Ensure: minimize collapses to a 1-row pill (re-expandable), pop-out opens detached window, close fully unmounts the shadow host.
- Verify each button has a visible focus ring + aria-label and works via keyboard.
- Acceptance: all three header buttons behave as labeled in both popup and floating surfaces.

### Phase 5 — Color & surface refresh (CSS Peeper-grade)
- Rework `extension-src/panel/styles.css` dark tokens:
  - Background: layered `#0E1116` (root) / `#151A22` (surface) / `#1C232E` (raised) instead of flat near-black.
  - Border: `#262E3B` hairlines (1px, 60% opacity).
  - Text: `#E6EAF2` primary, `#9AA4B2` secondary, `#5E6878` muted.
  - Accent: keep blue family but shift to `#3B82F6` → `#2563EB` (hover) for better contrast on the new surface.
  - Active tab underline: 2px accent + subtle glow.
  - Buttons: 10px radius, soft inner highlight, 150ms ease transitions.
- Light theme gets a parallel pass (`#FAFBFC` / `#F1F3F7` / `#E5E8EE`).
- All colors via existing CSS custom properties — no hardcoded hex inside components.
- Acceptance: side-by-side with CSS Peeper, the panel reads as a peer (clear hierarchy, depth, breathing room).

### Phase 6 — Tests + repackage
- Update/extend Vitest specs that snapshot the panel structure (tab list, hidden settings, per-tab Smart Share presence).
- Run full extension test suite, fix any breakages from removed DOM nodes.
- Repackage `public/inspect-page.zip` + sha256, bump extension version to `2.5.3`, update CHANGELOG.

## Out of scope
- WP plugin changes (none needed for this UI pass).
- Inspect view internals (untouched).
- Billing / pricing card (separate Option C thread).

## Open questions (please confirm before Phase 1)
1. **Settings surface**: popover anchored to ≡ (compact, in-panel) or a slide-in sheet from the left? I'd default to **popover** for popup parity.
2. **Smart Share label**: keep "Smart Share" or rename to "Share Links" (matches spec §24)? I'd default to **"Share Links"**.
3. **Minimize behavior**: collapse to header-only pill in place, or dock to bottom-right corner? I'd default to **header-only pill in place**.

Send `next` to start Phase 1 (or answer the questions first and I'll incorporate).
