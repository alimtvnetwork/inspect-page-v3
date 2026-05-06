
# Spec Improvement Plan — make `spec/21-app/` blind-implementable

Goal: bring the spec to a state where any competent AI engineer can build the extension end-to-end **without asking a single question**. No code will be written. Only files inside `spec/21-app/` will be created or edited.

## What "blind-implementable" means here

A spec is blind-implementable when every one of these is true:
1. Every file the engineer must create is named, with its purpose, exports, and size budget.
2. Every cross-context message has a typed contract (name, payload, response, errors).
3. Every algorithm has step-by-step pseudocode, not prose.
4. Every external API call has the exact signature, options, and failure modes listed.
5. Every UI surface has a wireframe, state machine, copy strings, and keyboard map.
6. Every acceptance test is a concrete script: "do X on site Y, expect Z file with property W".
7. No decision is left to the implementer. Where two paths exist, one is picked and the other is recorded as rejected with reason.

Today's spec is a strong outline but still leaves dozens of decisions implicit. The phases below close those gaps.

## Audit — gaps in the current spec

```text
Area                          Gap
----------------------------  -------------------------------------------------
Message contracts             MessageKind enum mentioned but not enumerated
                              with payload/response shapes.
File-by-file plan             Source layout listed but no per-file exports,
                              line budgets, or dependency arrows.
Algorithms                    Stitch + matched-rules + isolated render
                              described in prose; need numbered pseudocode.
Chrome API usage              No exact call signatures, options objects,
                              quotas, or error codes.
UI                            No wireframes, no state machine, no copy table,
                              no keyboard table, no a11y rules.
Settings                      Tokens listed but no JSON schema or defaults.
Naming                        Pattern given but no worked examples and no
                              collision-handling rule.
Errors                        Categories listed but no error catalog with
                              codes, messages, and recovery.
Edge cases                    iframes, shadow DOM, CSP, data: URLs, SPA
                              route changes, very tall pages — unaddressed.
Performance                   No budgets (max page height, max ZIP size,
                              max capture time, throttle constants).
Security/privacy              No statement on what leaves the browser
                              (nothing) or how secrets in DOM are handled.
Test plan                     AC list exists but no fixture sites, no
                              expected-output snapshots, no manual script.
Build/package                 Vite config, tsconfig, tailwind config,
                              manifest.json final form not pinned.
Distribution page             One paragraph; needs full copy + IA.
Glossary / index              No entry point, no glossary, no doc map.
```

## Phased delivery (you drive with "next")

### Phase A — Foundation docs
New / rewritten files:
- `README.md` (spec index + reading order + glossary).
- `00-overview.md` expanded with personas, success metrics, explicit non-goals.
- `13-decisions.md` — Decision log: every choice with **Chosen / Rejected / Reason**.
- `14-glossary.md` — Terms (DPR, sticky, offscreen doc, matched rule, etc.).

### Phase B — Contracts (the most important phase)
- `15-message-contracts.md` — Full `MessageKind` enum, every payload + response + error shape, sender/receiver matrix, timeout per message.
- `16-storage-schema.md` — `chrome.storage.local` JSON schema, defaults, migration rule.
- `17-file-formats.md` — Exact byte layout of the ZIP, exact Markdown template with placeholders, exact `manifest.json` (export metadata) schema.

### Phase C — Algorithms as pseudocode
Rewrite these with numbered steps, inputs, outputs, invariants, and failure branches:
- `03-full-page-export.md` — collection pipeline pseudocode + per-step error table.
- `06-screenshot-strategy.md` — stitch algorithm pseudocode, throttle math, sticky-restore guarantee, DPR worked example, seam policy.
- `05-element-export.md` — matched-rule walker, computed-style diff, isolated render steps, Base64 size cap.
- `04-element-picker.md` — picker state machine diagram, event capture order, shadow-root isolation rules.

### Phase D — UI specification
- `02-ui-panel.md` rewritten with: ASCII wireframes (popup + floating panel + settings), full state machine (`PanelStatus` transitions), copy table (every visible string), keyboard map, focus order, a11y (roles, aria-live for status), z-index + pointer-events rules, drag bounds.
- `18-distribution-page.md` — Lovable landing page IA: sections, copy, install steps, screenshots placeholders, download button behavior.

### Phase E — Edges, limits, errors, security
- `09-error-handling.md` upgraded to a full **error catalog**: `code | category | message | user message | recovery | log level`.
- `19-edge-cases.md` — iframes, shadow DOM, CSP-blocked inline, `data:` and `blob:` URLs, SPA route change mid-export, infinite-scroll pages, pages > N px, fonts, web components, print stylesheets.
- `20-performance-budgets.md` — Hard numbers: max page height (px), max ZIP size, captureVisibleTab gap (ms), per-frame settle (ms), max stitched canvas dimension, fallback when exceeded.
- `21-security-privacy.md` — Data never leaves browser, password field redaction policy, no telemetry, permission justifications mirrored from `08`.

### Phase F — Build, test, acceptance
- `12-build-and-package.md` upgraded with: pinned Node version, exact `package.json` deps + versions, full `vite.config.ts` outline, `tsconfig` rules, `manifest.json` final form, build command sequence, packaging command, output checksum step.
- `22-test-plan.md` — Manual test script per AC, with named fixture sites (e.g. `example.com`, `en.wikipedia.org/wiki/CSS`, a long Medium article, a sticky-header SaaS landing page), expected file shapes, and a smoke checklist.
- `11-acceptance-criteria.md` rewritten as **executable checklist** referencing test IDs from `22-test-plan.md`.
- `10-coding-guidelines.md` upgraded with examples of compliant vs non-compliant code for every rule.

### Phase G — Final pass
- `23-implementation-order.md` — Exact build order, file-by-file, with "you can start file X once files Y and Z exist" dependencies. This is the file the implementing AI reads first after `README.md`.
- Update `README.md` index with all new files and reading order.
- Update `.lovable/plan.md` and `spec/plan.md` to reflect the upgraded spec.

## Final folder shape after all phases

```text
spec/
├── plan.md
└── 21-app/
    ├── README.md
    ├── 00-overview.md
    ├── 01-architecture.md
    ├── 02-ui-panel.md
    ├── 03-full-page-export.md
    ├── 04-element-picker.md
    ├── 05-element-export.md
    ├── 06-screenshot-strategy.md
    ├── 07-file-naming.md
    ├── 08-permissions.md
    ├── 09-error-handling.md
    ├── 10-coding-guidelines.md
    ├── 11-acceptance-criteria.md
    ├── 12-build-and-package.md
    ├── 13-decisions.md
    ├── 14-glossary.md
    ├── 15-message-contracts.md
    ├── 16-storage-schema.md
    ├── 17-file-formats.md
    ├── 18-distribution-page.md
    ├── 19-edge-cases.md
    ├── 20-performance-budgets.md
    ├── 21-security-privacy.md
    ├── 22-test-plan.md
    ├── 23-implementation-order.md
    └── diagrams/
        ├── architecture.mmd
        ├── flows.mmd
        ├── picker-state.mmd      (new)
        ├── panel-state.mmd       (new)
        └── stitch-sequence.mmd   (new)
```

## How phases map to "next"

```text
next #1 → Phase A (Foundation: README, overview, decisions, glossary)
next #2 → Phase B (Contracts: messages, storage, file formats)
next #3 → Phase C (Algorithms as pseudocode)
next #4 → Phase D (UI spec + distribution page)
next #5 → Phase E (Errors, edges, perf, privacy)
next #6 → Phase F (Build, test, acceptance, coding guide examples)
next #7 → Phase G (Implementation order + index refresh)
```

If a phase grows past one "next", I will list the remaining sub-tasks at the end of that response so the following "next" continues from that list.

## Guarantees

- No source code in any file under `spec/`. Pseudocode and TypeScript-shaped contracts only.
- Every file ≤ 200 lines.
- Every external dep pinned to a specific major version.
- Every rejected option recorded in `13-decisions.md` with the reason, so the implementing AI never reopens settled questions.

```text
Do you understand?
```

Say **next** to start Phase A.
