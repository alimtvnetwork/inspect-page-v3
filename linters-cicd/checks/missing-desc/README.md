# MISSING-DESC-001 — Free-Text Columns: Presence + Nullability

**Level:** error
**Linter version:** 1.2.0 (refactored to share `_lib/free_text_columns.py`)
**Spec:** [`spec/04-database-conventions/02-schema-design.md`](../../../spec/04-database-conventions/02-schema-design.md) §6 (v3.4.0)
**Naming source:** [`01-naming-conventions.md`](../../../spec/04-database-conventions/01-naming-conventions.md) Rules 10 / 11 / 12 (v3.5.0)
**Sibling:** [`DB-FREETEXT-001`](../free-text-columns/README.md) (presence-only, no waivers — back-compat shim)

## What it flags

Two violation classes per `CREATE TABLE`:

### 1. Missing required column (Rules 10 / 11)

| Table category (suffix heuristic) | Required columns | Rule |
|----|----|----|
| Entity / reference / lookup / master-data | `Description TEXT NULL` | 10 |
| Transactional (`*Transaction`, `*Invoice`, `*Order`, `*Payment`, `*Bill`, `*Charge`, `*Refund`, `*Settlement`) | `Notes TEXT NULL` AND `Comments TEXT NULL` | 11 |
| Audit / log (`*Log`, `*History`, `*Event`, `*AuditLog`) | `Notes TEXT NULL` | 11 (notes-only) |
| Pure join (no `{TableName}Id` PK) | — exempt — | — |

### 2. Wrong nullability / default (Rule 12)

Whenever `Description`, `Notes`, or `Comments` appears on **any** table,
it MUST NOT carry `NOT NULL` and MUST NOT have a `DEFAULT` value.

## Waiver syntax

Some `CREATE TABLE` examples in the spec tree exist to teach a different
concept (PK choice, normalization, FK syntax, junction-table mechanics).
Adding `Description`/`Notes`/`Comments` to those examples would obscure
the lesson. For these cases, use a **waiver** with a mandatory reason.

### Block-level waiver — skip the next CREATE TABLE only

```sql
-- linter-waive: MISSING-DESC-001 reason="PK-sizing example; columns omitted for clarity"
CREATE TABLE User (
    UserId INTEGER PRIMARY KEY AUTOINCREMENT
);
```

The waiver line MUST appear within the **5 non-blank lines** immediately
preceding the `CREATE TABLE` keyword, and the chain must consist only of
`--` comments (no other SQL statements between the waiver and the block).

### File-level waiver — skip every block in the file

```sql
-- linter-waive-file: MISSING-DESC-001 reason="Migration history file; legacy schema frozen"

CREATE TABLE LegacyOne ( ... );
CREATE TABLE LegacyTwo ( ... );
```

### Reason is mandatory

Bare `-- linter-waive: MISSING-DESC-001` (no `reason="..."`) is **ignored**.
This forces every suppression to be reviewable.

### When to waive vs. when to fix

| Scenario | Action |
|----------|--------|
| Real production schema or migration | **Fix** — add the columns |
| Spec example showing a real table the app will create | **Fix** — keep the spec correct |
| Pedagogical mini-example (PK choice, normalization, FK syntax) | **Waive** with a clear reason |
| Diagram-only ASCII / Mermaid that happens to look like SQL | **Waive** — `reason="diagram"` |
| Generated/reflective DDL inside an executable code block | **Waive** — `reason="runtime DDL"` |

## Relationship to DB-FREETEXT-001

`DB-FREETEXT-001` covers presence only. `MISSING-DESC-001` is the
stricter superset: presence (10/11) **plus** nullability (12), **plus**
the waiver mechanism. Projects SHOULD enable MISSING-DESC-001 instead
of DB-FREETEXT-001 when they want full Rule 10/11/12 enforcement in a
single rule ID with auditable suppressions.

## Scope

`.sql` files anywhere, plus any `.sql` file under a `migrations` /
`migration` path segment.

## Limitations

* Suffix heuristic — tables whose category cannot be inferred default
  to entity/master-data and require `Description`.
* Go `embed.FS` SQL strings out of scope (mirrors BOOL-NEG-001 / DB-FREETEXT-001).
* Markdown SQL fences — when this linter is wrapped by an audit script
  that extracts ``` ```sql ``` blocks from `.md` files, the waiver lines
  must live **inside** the fence (they are SQL comments).
