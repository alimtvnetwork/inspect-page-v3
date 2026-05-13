# Implementation Plan — Inspect Page Chrome Extension

Mirror of `.lovable/plan.md`. Source of truth for phase tracking.

## Locked decisions
See `spec/21-app/13-decisions.md` (D1–D20).

## Spec phases (DONE)
- Phase 0 — Initial spec scaffold.
- Phase A — Foundation: README, overview, decisions, glossary.
- Phase B — Contracts: messages, storage, file formats.
- Phase C — Algorithms as numbered pseudocode.
- Phase D — UI spec + distribution page.
- Phase E — Errors, edge cases, performance budgets, security.
- Phase F — Build, test, acceptance, coding guidelines.
- Phase G — Implementation order + diagrams + plan refresh.

The spec under `spec/21-app/` is now blind-implementable: any AI engineer can build v1 by reading `spec/21-app/README.md` then `spec/21-app/23-implementation-order.md` and following the stages.

## Implementation phases (USER drives with "next")
Per `spec/21-app/23-implementation-order.md`:

1. Stage 0 — Skeleton (manifest, configs, constants, types, copy, defaults, logger).
2. Stage 1 — Storage + settings facade.
3. Stage 2 — SW + CS message routers.
4. Stage 3 — Popup UI.
5. Stage 4 — Floating panel mount.
6. Stage 5 — Full Page collection (no screenshot).
7. Stage 6 — Offscreen document + scroll-and-stitch screenshot.
8. Stage 7 — Element picker.
9. Stage 8 — Element export pipeline.
10. Stage 9 — Edge cases and polish.
11. Stage 10 — Lovable distribution landing page.
12. Stage 11 — Package and ship.

User says "next" to begin Stage 0.
