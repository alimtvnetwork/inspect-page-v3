# Inspect Page — Extension v2.6.3

Release date: 2026-05-18
WP plugin: unchanged (v2.5.5)

## Highlights

UI refresh — "Blueprint" visual language across the entire extension.

The popup, floating in-page panel, and every Inspect / Element sub-panel
now use a clean light-mint-on-white aesthetic inspired by wireframe
blueprint mockups: white rounded cards with soft shadows, mint pill
buttons, soft mint-tinted chips and accents, and decorative floating
circles in the popup canvas.

The mint brand color (#2DD4A8) is unchanged — only the surrounding
surface flipped from a dark glow theme to a bright light theme.

## What changed

- New design tokens in `extension-src/panel/styles.css`:
  `--ext-bg`, `--ext-card`, `--ext-fg`, `--ext-muted`, `--ext-border`,
  `--ext-mint`, `--ext-mint-hover`, `--ext-mint-soft`, `--ext-shadow-card`,
  `--ext-shadow-glow`.
- Legacy `--lpe-*` tokens now alias the new `--ext-*` tokens so all
  existing components auto-adopt the new look with no JSX edits.
- New primitive utility classes for future work: `.lpe-card`,
  `.lpe-pill-btn`, `.lpe-pill-btn--ghost`, `.lpe-chip`, `.lpe-input`,
  `.lpe-thumb`, `.lpe-decor`.
- Popup `index.html` body background: `#F5F7F6` (was transparent).
- Popup surface: white-card header with mint brand-dot, pill tab row,
  mint pill primary buttons, mint-soft progress bar, decorative mint
  circles bleeding off the top-right and bottom-left corners.
- Floating panel: rounded white-card container, mint brand-dot header,
  circular ghost controls, same pill button + body-gutter treatment.
- Inspect + Element sub-panels: white rounded cards for overview/typo/
  color/contrast/cssinfo/inspector blocks, mint-soft AA + contrast
  chips, mint pill code-drawer tabs, mint-tinted box-model layers,
  rounded modals with mint-soft headers, restyled skeleton + toasts.

## Compatibility

- No behavior, REST, or storage changes.
- No new permissions.
- 194/194 vitest passing.
- WP plugin v2.5.5 unchanged — works with both extension v2.6.2 and v2.6.3.

## Files

- `public/inspect-page.zip` — Chrome extension (193K)
- `public/inspect-page.zip.sha256` — checksum
