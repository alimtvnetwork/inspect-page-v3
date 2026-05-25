# Export panel — 4 fixes (sequential)

I'll implement each on your `next`.

## Step 1 — Export diagnostics overlap
The expanded `<details>` body still hides the Copy details / Retry buttons sitting below. Fix by removing the absolute/opaque-overlay pattern: give `.lpe-export-diagnostics` `position: relative`, drop any negative margins, ensure the body flows in normal layout, and add `margin-bottom: 10px` so the action row beneath becomes visible.

Files: `extension-src/panel/styles.css`, `extension-unpacked/index.css`.

## Step 2 — File name row padding
The "File name" label hugs the left edge and the input hugs the right edge of the card (red boxes in screenshot). Add proper horizontal padding to `.lpe-file-name-row` (e.g. `padding: 10px 14px`), gap between label and input (`gap: 12px`), and ensure the input has `flex: 1` so it doesn't touch the card border. Also tighten the `Export for AI` card to give right-side padding so the MD / MD+files buttons aren't flush.

Files: `extension-src/panel/styles.css`, `extension-unpacked/index.css`.

## Step 3 — Export panel scroll cutoff
Bottom of the export panel is clipped — can't scroll past the last card. Fix the panel body's overflow: ensure the scroll container has `overflow-y: auto`, `min-height: 0` on flex parents, and add bottom padding (`padding-bottom: 24px`) so the last card isn't pinned to the edge.

Files: `extension-src/panel/styles.css`, `extension-src/panel/mountFloatingPanel.tsx` if needed.

## Step 4 — Text Typography orange border/background
The orange accent border/background on typography cards looks harsh. Replace with the neutral surface border (`var(--lpe-border)`) and remove any accent-tinted background, keeping the dark-mint theme but without the orange ring.

Files: `extension-src/panel/styles.css`, `extension-unpacked/index.css`.

Say **next** to start with Step 1.
