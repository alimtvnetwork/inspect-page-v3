# DB-FREETEXT-001 — Free-Text Columns Required (presence only)

**Level:** error
**Linter version:** 1.1.0 (refactored to share `_lib/free_text_columns.py`)
**Spec:** [`spec/04-database-conventions/02-schema-design.md`](../../../spec/04-database-conventions/02-schema-design.md) §6
**Naming source:** [`01-naming-conventions.md`](../../../spec/04-database-conventions/01-naming-conventions.md) Rules 10 / 11 (v3.5.0)

## What it flags

`CREATE TABLE` statements that omit the required nullable free-text columns:

| Table category (by name suffix) | Required columns | Rule |
|---------------------------------|------------------|------|
| Entity / reference / lookup / master-data | `Description TEXT NULL` | 10 |
| Transactional (`*Transaction`, `*Invoice`, `*Order`, `*Payment`, `*Bill`, `*Charge`, `*Refund`, `*Settlement`) | `Notes TEXT NULL` AND `Comments TEXT NULL` | 11 |
| Audit / log (`*Log`, `*History`, `*Event`, `*AuditLog`) | `Notes TEXT NULL` | 11 (notes-only) |
| Pure join / pivot (no `{TableName}Id` PK) | — exempt — | — |

## What it does NOT flag

* **Rule 12** (NOT NULL / DEFAULT on the reserved columns) — that is
  enforced by the sibling rule [`MISSING-DESC-001`](../missing-desc/README.md).
* **Waivers** — DB-FREETEXT-001 ignores `-- linter-waive` comments to
  preserve v1.0 CI behaviour. If you need the waiver mechanism, switch
  to MISSING-DESC-001.

## Relationship to MISSING-DESC-001

Both rules share the same classifier and column-detection logic via
`_lib/free_text_columns.py` — they cannot drift apart on classification.

| Concern | DB-FREETEXT-001 | MISSING-DESC-001 |
|---------|----------------|------------------|
| Presence (Rules 10/11) | ✅ | ✅ |
| Nullability (Rule 12) | ❌ | ✅ |
| Waiver comments | ❌ | ✅ |

**Recommendation:** new pipelines should enable **MISSING-DESC-001**
only. DB-FREETEXT-001 remains for back-compat with v1.0 configs.

## Why

Schemas evolve slower than business needs. A nullable text column lets
operators and downstream tools attach context **without a migration**.
`Notes` carries internal/operational context; `Comments` carries
human-facing/discussion context. The column names are fixed by the
naming spec — synonyms (`Memo`, `Remarks`, `desc`) are forbidden.

## Scope

`.sql` files anywhere, plus any `.sql` file under a `migrations` /
`migration` path segment.

## Limitations

* Classification is suffix-heuristic. A table whose category cannot be
  inferred from its name defaults to **entity/master-data** and is
  required to declare `Description`.
* Go `embed.FS` SQL strings are out of scope for v1 (matches BOOL-NEG-001).
