# spec/21-app — Inspect Page Chrome Extension

This folder is the **single source of truth** for building the extension. An implementing AI must be able to read these documents in order and ship the product without asking a question.

## Reading order

1. `README.md` (this file) — index and conventions.
2. `00-overview.md` — what we are building and why.
3. `13-decisions.md` — every locked decision; do NOT reopen these.
4. `14-glossary.md` — terminology used across all docs.
5. `01-architecture.md` — MV3 components and their responsibilities.
6. `15-message-contracts.md` — every cross-context message (the wire protocol).
7. `16-storage-schema.md` — persisted state shape.
8. `17-file-formats.md` — exact ZIP and Markdown layouts produced by the extension.
9. `02-ui-panel.md` — popup + injected panel UI spec.
10. `03-full-page-export.md` — full-page pipeline pseudocode.
11. `06-screenshot-strategy.md` — scroll-and-stitch algorithm.
12. `04-element-picker.md` — picker state machine.
13. `05-element-export.md` — element export pipeline.
14. `07-file-naming.md` — filename rules with worked examples.
15. `08-permissions.md` — manifest permissions and justifications.
16. `09-error-handling.md` — error catalog with codes.
17. `19-edge-cases.md` — iframes, shadow DOM, CSP, SPAs, etc.
18. `20-performance-budgets.md` — hard numeric limits.
19. `21-security-privacy.md` — data handling rules.
20. `10-coding-guidelines.md` — enforceable style rules with examples.
21. `12-build-and-package.md` — exact build + packaging pipeline.
22. `22-test-plan.md` — manual test scripts with fixture sites.
23. `11-acceptance-criteria.md` — executable checklist.
24. `18-distribution-page.md` — Lovable landing page spec.
25. `23-implementation-order.md` — file-by-file build order. Read this last, code from it first.
26. `24-export-modes.md` — v2 four-mode export toolbar (MD / MD+files / ZIP / Share Links).
27. `25-share-links.md` — WordPress plugin backend, App-Password auth, REST routes, expiry.
28. `26-implementation-order-v2.md` — v2 staged rollout.


## Conventions

- **No source code** in any document. Pseudocode and TypeScript-shaped contracts only.
- **Pseudocode style**: numbered steps. Inputs / Outputs / Invariants / On failure for every algorithm.
- **Identifiers**: `enum` names PascalCase, members PascalCase, constants UPPER_SNAKE.
- **Cross-references**: link as `see 15-message-contracts.md#RunExport`.
- **MUST / SHOULD / MAY** follow RFC 2119.
- **File budget**: each spec file ≤ 200 lines. Each source file (when built) ≤ 100 lines.
- **No magic numbers in docs either**: every number is named in `20-performance-budgets.md`.

## Diagrams

All diagrams are Mermaid (`.mmd`) under `diagrams/`. They are normative — if a diagram and prose disagree, the diagram wins.

## Status legend

- `LOCKED` — decided, do not change without updating `13-decisions.md`.
- `OPEN` — must be resolved before that phase begins.
- `DEFERRED` — out of v1 scope; recorded for v2.

At the time of writing, every decision required for v1 is `LOCKED`.
