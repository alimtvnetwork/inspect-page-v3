# Inspect Page — Extension v2.7.26

## What's new

### Text Typography (CSS Peeper–style)
A new section at the bottom of Inspect Mode lists every distinct text style
used on the page — one card per unique combination of tag + font family +
size + weight + color. Each card shows:

- The tag label (Paragraph, Span, Heading 1, Link, Button, …) and instance count
- A live `AaBbCc…` sample rendered in the element's actual font/size/weight/color
- A Locate button that scrolls the first match into view and flashes a ring
- "Show details ›" — opens a drawer with the full breakdown (family, stack,
  size, weight, line height, letter spacing, color, selector) with one-click
  copy for each field

Bounded to 60 groups and the existing 6000-element walk budget, so big
pages still finish well under a second.

### Account section
Inspect Mode now ends with an Account card so users can sign in / out and
manage their plan without leaving the inspector:

- Signed out → "Sign in" opens the WP login bridge directly
- Signed in → display name + email, plan badge (Free X/5 or Pro · unlimited),
  "Upgrade to Pro" (free) or "Manage subscription" (Pro), "Sign out"

Pure UI wrapper over the existing `/billing/status`, `/billing/checkout`,
`/billing/portal` endpoints — no new backend.

## Changed files
- `extension-src/inspect/types.ts` — `TypographyGroup` + `typography[]` on `InspectSnapshot`
- `extension-src/inspect/collectSnapshot.ts` — per-tag grouping pass
- `extension-src/panel/inspect/InspectTextTypography.tsx` (new)
- `extension-src/panel/inspect/InspectAccount.tsx` (new)
- `extension-src/panel/inspect/InspectShell.tsx` — mount both below Element Inspector
- `extension-src/panel/styles.css` — `.lpe-text-typo-*` + `.lpe-account-*` (dark-mint theme)
- `extension-src/manifest.json` + `extension/package.json` → 2.7.26
- `public/inspect-page.zip` + `public/inspect-page.zip.sha256` repackaged

## Verification
- 117 vitest pass (12 unrelated pre-existing `happy-dom` resolution warnings)
- Zip 310K
- sha256: `23e9981f27527ad31df4ad3152f5efe421a0483a2103a944801c94efb5ace3ae`