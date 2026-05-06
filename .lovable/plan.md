# Plan — LLM Page Export Chrome Extension

## Spec phase — DONE
The spec under `spec/21-app/` is blind-implementable. Index in `spec/21-app/README.md`. File-by-file build order in `spec/21-app/23-implementation-order.md`.

## Locked decisions
See `spec/21-app/13-decisions.md`.

## Build phases (you drive with "next")

1. **Stage 0 — Skeleton** — `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.json`, icons, `shared/constants.ts`, `shared/types.ts`, `shared/copy.ts`, `shared/defaults.ts`, `shared/logger.ts`. Verify `bun run lint && bun run build` clean.
2. **Stage 1 — Storage / settings facade** — `shared/settings.ts` + Vitest tests.
3. **Stage 2 — SW + CS message routers** — Envelope dispatcher, `Ping`, `GetSettings`, `SetSettings`.
4. **Stage 3 — Popup UI** — `<ExportPanel>` shared component, popup shell, settings form, disabled state for unsupported pages.
5. **Stage 4 — Floating panel mount** — Shadow DOM mount, drag, position persistence.
6. **Stage 5 — Full Page collection** — HTML/CSS/JS collectors, naming, ZIP bundle (placeholder PNG).
7. **Stage 6 — Offscreen + screenshot** — Offscreen document, stitch loop, sticky restore, keep-alive alarm.
8. **Stage 7 — Element picker** — Overlay, state machine, capture-phase listeners.
9. **Stage 8 — Element export** — selector path, matched rules, computed diff, in-context shot, isolated render, MD assembly with budget degradation.
10. **Stage 9 — Edge cases & polish** — SPA abort, page-too-large, disabled URLs, reduced-motion, keyboard commands.
11. **Stage 10 — Distribution landing page** — In `src/pages/Index.tsx` per `spec/21-app/18-distribution-page.md`. Fetch+blob download.
12. **Stage 11 — Package & ship** — `scripts/package.sh`, lint+test+build+package, verify size + sha256, walk through `spec/21-app/11-acceptance-criteria.md`.

If a stage grows past one "next", the remaining sub-tasks will be listed at the end of that response.

```text
Do you understand?
```

Say **next** to start Stage 0.
