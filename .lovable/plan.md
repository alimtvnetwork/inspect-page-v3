# Theme Color Customizer — Landing Site

## Scope
Add a user-controlled theme color feature to the **marketing landing site** (`src/...`) only.
The Chrome extension popup + in-page floating panel keep their locked dark-mint theme (project memory: "Extension theme LOCKED"). This work does NOT touch `extension-src/`.

Default theme remains the current **Blueprint** (royal blue on white). Users can switch to other presets — including a **Riseup Asia** preset derived from https://present-v3.lovable.app/ (dark bg `#0B0B0B`, amber accent `#F59E0B`) — or pick a fully custom accent color.

## Phases

### Phase 1 — Theme engine + presets
- New `src/theme/themes.ts` with preset definitions. Each preset = a set of HSL token values mapped onto the existing tokens in `src/index.css` (`--background`, `--foreground`, `--primary`, `--primary-glow`, `--primary-soft`, `--accent`, `--card`, `--border`, `--ring`, `--gradient-primary`, `--shadow-glow`, etc.).
- Presets shipped:
  1. **Blueprint** (current default — royal blue on white)
  2. **Riseup Asia** (dark `#0B0B0B` bg, amber `#F59E0B` accent — matches reference)
  3. **Midnight Indigo** (dark + indigo)
  4. **Emerald** (light + green)
- New `src/theme/ThemeProvider.tsx`: React context that
  - reads saved theme from `localStorage` key `inspect-page.landing-theme` (preset id + optional custom accent HSL),
  - on mount applies the values by setting CSS variables on `document.documentElement.style`,
  - exposes `{ theme, setPreset, setCustomAccent, resetToDefault }`.
- Wrap `src/App.tsx` (or `src/main.tsx`) with `<ThemeProvider>`.

### Phase 2 — Theme switcher UI
- New `src/components/landing/ThemeSwitcher.tsx` — small floating "paint" button (bottom-right) that opens a popover/sheet (shadcn `Popover` + `RadioGroup`) with:
  - Preset swatches (4 circles, click to apply).
  - A custom-accent color input (`<input type="color">`) that maps the chosen HEX to HSL and overrides `--primary`/`--primary-glow`/`--ring`.
  - "Reset to default" button.
- Mount once in `src/pages/Index.tsx` (and `NotFound`, `Privacy`, `Terms` if we want it site-wide — confirm during build).
- Live preview: every change instantly re-applies CSS vars, so all existing sections (Hero, Pricing, etc.) recolor automatically because they already use semantic tokens.

### Phase 3 — Polish + persistence + a11y
- Persist selection across reloads (already from Phase 1).
- Respect `prefers-reduced-motion` for any transition.
- Add `aria-label`s and keyboard support for the switcher.
- Add a tiny "Theme: Blueprint" caption inside the popover.
- Smoke-check both light + dark presets across Hero / Pricing / WhatsNew / Footer.

## Technical notes
- All color edits go through CSS custom properties in HSL (matching existing `index.css` convention). No component changes required since components already use `bg-primary`, `text-foreground`, etc.
- Custom HEX → HSL conversion: small util in `src/theme/colorUtils.ts`. Output as `"H S% L%"` string (Tailwind/shadcn expects values without `hsl()` wrapper).
- localStorage shape: `{ presetId: string; customAccent?: { h:number; s:number; l:number } }`.
- No backend, no extension changes, no WP plugin changes.

## Out of scope
- Extension popup / floating panel theming (locked).
- Per-section overrides.
- Saving theme per-user on the server.

## Acceptance
- Visiting `/` shows the current Blueprint look by default.
- Clicking the switcher → "Riseup Asia" instantly turns the page dark with amber CTAs (matches present-v3 vibe).
- Picking a custom color updates `--primary` everywhere (Hero CTA, Pricing highlight, links).
- Reload preserves the choice.
- "Reset" returns to Blueprint.

Say **next** to execute Phase 1.