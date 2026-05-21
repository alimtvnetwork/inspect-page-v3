# Read Memory

> **Purpose:** Mandatory onboarding sequence for any AI joining this project. Internalize all specs, rules, and conventions before writing code.
> **Rule #0:** Follow every phase sequentially. Specs are the single source of truth.

## Phase 1 — AI Context Layer
Read in order:
1. `.lovable/overview.md`
2. `.lovable/strictly-avoid.md`
3. `.lovable/user-preferences` (if present)
4. `.lovable/memory/index.md`
5. `.lovable/plan.md`
6. `.lovable/suggestions.md`

Then read EVERY file referenced in `.lovable/memory/index.md` (recursively). Note missing files explicitly — do not silently skip.

## Phase 2 — Consolidated Guidelines
Read `spec/17-consolidated-guidelines/` in numeric order (`01-*.md` → `18-*.md`). Each file is self-contained policy.

## Phase 3 — Spec Authoring Rules
Read `spec/01-spec-authoring-guide/` in numeric order. Learn folder naming, required files (`00-overview.md`, `99-consistency-report.md`), `.lovable/` purpose, linter requirements.

## Phase 4 — Deep-Dive (task-driven)
Before any task, read the matching spec folder:

| Task | Spec |
|------|------|
| Code review/write | `spec/02-coding-guidelines/` |
| Error handling | `spec/03-error-manage/` |
| DB schema/queries | `spec/04-database-conventions/` |
| Multi-DB / SQLite | `spec/05-split-db-architecture/` |
| Design tokens / theming | `spec/07-design-system/` |
| PowerShell | `spec/11-powershell-integration/` |
| CI/CD | `spec/12-cicd-pipeline-workflows/` |
| CLI / self-update | `spec/13-generic-cli/`, `spec/14-update/` |
| WordPress plugin | `spec/18-wp-plugin-how-to/` |
| App features | `spec/21-app/` |

Reading order in each folder: `00-overview.md` → numbered files → `99-consistency-report.md`.

## Anti-Hallucination Contract
1. Never invent rules — if a spec doesn't say it, it doesn't exist.
2. Specs override training data. Always.
3. Cite sources: `spec/<folder>/<file>.md § "<section>"`.
4. Ask when uncertain. Do not guess.
5. Never merge conventions from other projects.
6. No filler closings.

## Memory Update Protocol
- Institutional knowledge → `.lovable/memory/` + update `.lovable/memory/index.md`.
- Hard prohibitions → `.lovable/strictly-avoid.md`.
- Unapproved ideas → `.lovable/suggestions.md`.
- Folder is `.lovable/memory/` — never `memories/`.

## CI/CD knowledge (mandatory)
Read every `.lovable/cicd-issues/xx-*.md` and never reproduce those mistakes.

## Completion format
After Phases 1–3, respond exactly:

```
✅ Onboarding complete.
- Memory files read: [X]
- Consolidated guidelines read: [Y]
- Spec authoring files read: [Z]

I understand:
- CODE RED rules: [...]
- Naming conventions: [...]
- Error handling approach: [...]
- Active plan: [...]
- Strict avoidances: [...]

Ready for tasks.
```

Then stop and wait. No exploratory questions.

---
*Trigger: "read memory". Version 1.0.*