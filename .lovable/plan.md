# Plan — Multi-element picker

Today: one click = one pick = instant export. New: pick up to **11** elements, then finalize.

Locked from your answers:
- **Selection mode:** Toggle-click (click adds, click same again removes); Shift+Click also adds. Esc cancels.
- **Inspector focus:** Last-clicked active + chip strip switches focus.
- **Export shape:** Single combined `.md` / zip with one section per element, click order.
- **Cap:** 11 elements; 12th click ignored with toast "Limit reached (11)".

---

## Phase 1 — Picker state machine (additive, low-risk)
File: `extension-src/picker/picker.ts`
- Track `selections: Element[]` (max 11) inside picker state.
- Render persistent **green outline + numbered badge (1…11)** for each pick, layered in the shadow DOM so they survive scroll/resize.
- Replace "click = commit" with "click = toggle into selections".
- Add a sticky top-center bar inside shadow: `[ Done (N) ]  [ Cancel ]  N/11`.
- Add scroll + resize listeners to reposition selection overlays.
- New handler `onCommit(elements: Element[])` on `PickerHandlers`. Keep `onSelect` for back-compat (Enter key fast-path = 1-element commit).

## Phase 2 — Content-script pipeline (loop over picks)
File: `extension-src/content.ts`
- New `onCommit` handler: loop the array, run `collectElement` + `collectElementSnapshot` per element (sequential to avoid scroll thrash), assemble a `multiElementSnapshot: { items: ElementSnapshot[] }` in `StatusUpdatePayload`.
- Persist to `chrome.storage.session` under `inspect-page:last-pick` so popup re-hydrates.

## Phase 3 — Inspector UI (chips + last active)
Files: `extension-src/panel/element/ElementInspector.tsx`, `extension-src/panel/inspect/InspectShell.tsx`
- Horizontal chip strip at top: `#1 button.cta · #2 h1 · …`; last-clicked highlighted.
- Click chip → swap inspector body to that element's snapshot.
- "×" on chip → remove pick (calls back into panel state).

## Phase 4 — Export pipeline (combined .md / zip)
File: `extension-src/element/buildMarkdown.ts` + ZIP / Smart Share builders.
- `buildCombinedMarkdown(items[])` emits shared `## Source` once, then `## Element N — selector` blocks (outerHTML, matched CSS, computed diff, screenshot).
- Filename suffix: `…-{N}elems.md` / `.zip`.

## Phase 5 — Tests, package, version
- Update/add tests in `extension-src/picker/__tests__/` and `extension-src/element/__tests__/`.
- Rebuild → refresh `public/inspect-page.zip` + sha256.
- Bump manifest to v2.7.2.
- `docs/RELEASE-NOTES-v2.7.2.md` + memory line: "Picker supports multi-select up to 11."

---

## Open question
**Smart Share preview thumbnail when N>1:** use element #1, a stitched composite, or the full page? (Phase 4 needs this — default I'd pick = element #1.)

Say `next` to start Phase 1.

---

## Remaining tasks across all open plans
1. **Source-section enrichment** — Phases 1–5 (blocked on you pasting the default prompt text)
2. **Multi-element picker** — Phases 1–5 above (this plan)
