# Inverted-Field Codegen (Rule 9)

Implements the code-generation contract from
[`spec/04-database-conventions/01-naming-conventions.md`](../../spec/04-database-conventions/01-naming-conventions.md)
**Rule 9 §4** for Go, PHP, and TypeScript.

## What it does

Given a source file containing a struct/class with `Is*` / `Has*` boolean
fields tagged with their DB column, this tool emits a **companion file**
containing the derived (inverted) computed-property siblings.

| Stored DB column | Auto-derived field | Derivation |
|------------------|--------------------|------------|
| `IsActive`       | `IsInactive`       | `!IsActive` |
| `IsEnabled`      | `IsDisabled`       | `!IsEnabled` |
| `HasLicense`     | `HasNoLicense`     | `!HasLicense` |

The full canonical map lives in [`inversion_table.py`](inversion_table.py)
and is symmetric: `invert(invert(x)) == x`. Names not in the table fall
back to inserting `Not`/`No` after the `Is`/`Has` prefix.

## Usage

```bash
# Go
python3 inverted_fields.py --input User.go  --lang go
# → writes User.generated.go

# PHP
python3 inverted_fields.py --input User.php --lang php
# → writes User.generated.php

# TypeScript
python3 inverted_fields.py --input User.ts  --lang typescript
# → writes User.generated.ts

# Print to stdout instead
python3 inverted_fields.py --input User.go  --lang go --stdout
```

## Recognized source shapes

**Go** — struct field with `db:"…"` tag:

```go
type User struct {
    UserId     int64 `db:"UserId"`
    IsActive   bool  `db:"IsActive"`
    HasLicense bool  `db:"HasLicense"`
}
```

**PHP** — `#[Db('…')]` attribute on a typed property:

```php
class User {
    #[Db('IsActive')]
    public bool $IsActive;
}
```

**TypeScript** — `@DbField('…')` decorator on a boolean property:

```ts
class User {
    @DbField('IsActive')
    readonly IsActive!: boolean;
}
```

## Guarantees

1. The derived field is **always a method/getter** — never a property and
   never carries a `db` tag (Rule 9 §4).
2. The source file is **never modified**; output goes to
   `<basename>.generated.<ext>`.
3. Output starts with a `DO NOT EDIT` header pointing back to Rule 9.
4. Pairs are symmetric — running the codegen on already-inverted names
   round-trips back to the canonical form.
