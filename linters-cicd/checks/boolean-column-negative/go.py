#!/usr/bin/env python3
"""BOOL-NEG-001 (Go) — Forbid Not/No-prefixed boolean DB column names in Go.

Two complementary scanners run over every ``.go`` file:

1. **Struct-tag scanner** — walks ``type X struct { ... }`` blocks and
   inspects ``bool`` fields for forbidden column names declared via
   ``db:"..."`` (sqlx, jmoiron) or ``gorm:"column:..."`` tags. The
   *struct field name* is also checked because it usually round-trips
   to a column when no explicit tag is set (GORM default mapping).

2. **Embedded-SQL scanner** — locates raw string literals
   (back-tick-delimited) that contain ``CREATE TABLE`` and runs the
   exact same regex/allow-list logic as ``sql.py`` over them. Covers
   ``embed.FS``-style migration constants and inline DDL.

Two-tier detection (v2 — Task #07):
- Tier 1 (error)   — Is/Has + Not/No prefix.
- Tier 2 (warning) — suspect Cannot*/Dis*/Un* roots.
Replacement hints come from the codegen inversion table.

All forbidden/suspect/allow-list/hint logic lives in
``_lib/boolean_naming.py`` so the SQL and Go scanners stay in lock-step.

Snake-case column names like ``is_not_active`` are normalized to
PascalCase before matching so both naming styles are caught.

Spec:
- spec/04-database-conventions/01-naming-conventions.md  Rules 2, 8 & 9
- linters-cicd/checks/_lib/boolean_naming.py             (shared library)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.boolean_naming import (  # noqa: E402
    ALLOWLIST, NEG_PREFIX_RE, SUSPECT_ROOT_RE, format_message,
    is_forbidden, is_suspect,
)
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="BOOL-NEG-001",
    name="BooleanColumnNegativePrefix",
    short_description=(
        "Database boolean columns must not use Not/No prefixes "
        "(e.g. IsNotActive, HasNoLicense). Detected in Go via "
        "db:\"...\" / gorm:\"column:...\" struct tags and inside "
        "embedded SQL string literals. Suspect Cannot*/Dis*/Un* "
        "roots are flagged as warnings."
    ),
    help_uri_relative="../04-database-conventions/01-naming-conventions.md",
)

EXTENSIONS = [".go"]

# `type Name struct { ... }` — non-greedy so adjacent structs don't merge.
STRUCT_BLOCK_RE = re.compile(
    r"type\s+(?P<name>[A-Z][A-Za-z0-9_]*)\s+struct\s*\{(?P<body>.*?)\}",
    re.DOTALL,
)

# Field line: `FieldName bool [optional ...] `tag:"..."``
FIELD_LINE_RE = re.compile(
    r"^\s*(?P<field>[A-Z][A-Za-z0-9_]*)\s+(?P<type>\*?\b\w+\b)"
    r"[^`\n]*(?:`(?P<tag>[^`]*)`)?\s*$",
    re.MULTILINE,
)

# Tag pickers — db:"col" (sqlx) and gorm:"column:col;..." (gorm).
DB_TAG_RE = re.compile(r'\bdb:"([^"]+)"')
GORM_COLUMN_RE = re.compile(r'\bgorm:"[^"]*\bcolumn:([A-Za-z0-9_]+)')

# Back-tick raw string literals containing CREATE TABLE — embedded SQL.
RAW_STRING_RE = re.compile(r"`([^`]*\bCREATE\s+TABLE\b[^`]*)`", re.IGNORECASE)
SQL_CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE[^\(]*\((?P<body>.*?)\)\s*;",
    re.IGNORECASE | re.DOTALL,
)


def snake_to_pascal(snake: str) -> str:
    """``is_not_active`` → ``IsNotActive``. Idempotent for PascalCase input."""
    if "_" not in snake:
        return snake[:1].upper() + snake[1:] if snake else snake
    return "".join(part[:1].upper() + part[1:] for part in snake.split("_") if part)


def is_violation(name: str) -> bool:
    """Tier 1 only — preserved for v1 callers (test suite + go shim).

    Returns True iff *name* (snake or Pascal) is a forbidden Not/No
    prefix and not allow-listed. Use ``classify`` for the v2 two-tier
    result.
    """
    return classify(name) == "forbidden"


def classify(name: str) -> str:
    """Return 'forbidden' | 'suspect' | 'clean' for *name*."""
    pascal = snake_to_pascal(name)
    if is_forbidden(pascal):
        return "forbidden"
    if is_suspect(pascal):
        return "suspect"
    return "clean"


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def scan_struct_tags(text: str) -> list[tuple[str, int, str]]:
    """Tier 1 only — preserved name & shape for the v1 test suite.

    Returns ``(column_name, line_number, source_kind)`` for each
    *forbidden* struct-tag finding. Tier 2 (suspect) findings come
    from ``scan_struct_tags_v2``.
    """
    return [(n, l, k) for n, l, k, t in scan_struct_tags_v2(text) if t == "forbidden"]


def scan_struct_tags_v2(text: str) -> list[tuple[str, int, str, str]]:
    """v2 walker — emits ``(column, line, kind, tier)`` for forbidden + suspect."""
    out: list[tuple[str, int, str, str]] = []
    for block in STRUCT_BLOCK_RE.finditer(text):
        body = block.group("body")
        body_offset = block.start("body")
        for field in FIELD_LINE_RE.finditer(body):
            if field.group("type") not in ("bool", "*bool"):
                continue
            tag = field.group("tag") or ""
            field_name = field.group("field")
            abs_line = line_of(text, body_offset + field.start())

            kind = "struct-field"
            gorm_match = GORM_COLUMN_RE.search(tag)
            db_match = DB_TAG_RE.search(tag)
            if gorm_match:
                col, kind = gorm_match.group(1), "gorm-tag"
            elif db_match:
                col, kind = db_match.group(1), "db-tag"
            else:
                col = field_name

            tier = classify(col)
            if tier != "clean":
                out.append((snake_to_pascal(col), abs_line, kind, tier))
    return out


def scan_embedded_sql(text: str) -> list[tuple[str, int, str]]:
    """Tier 1 only — preserved for v1 test suite."""
    return [(n, l, k) for n, l, k, t in scan_embedded_sql_v2(text) if t == "forbidden"]


def scan_embedded_sql_v2(text: str) -> list[tuple[str, int, str, str]]:
    """v2 embedded-SQL walker — emits ``(column, line, kind, tier)``."""
    out: list[tuple[str, int, str, str]] = []
    for raw in RAW_STRING_RE.finditer(text):
        sql = raw.group(1)
        sql_offset = raw.start(1)
        for table in SQL_CREATE_TABLE_RE.finditer(sql):
            body = table.group("body")
            body_offset_in_sql = table.start("body")
            base = sql_offset + body_offset_in_sql
            for match in NEG_PREFIX_RE.finditer(body):
                name = match.group(1)
                if not is_forbidden(name):
                    continue
                out.append((name, line_of(text, base + match.start()),
                            "embedded-sql", "forbidden"))
            for match in SUSPECT_ROOT_RE.finditer(body):
                name = match.group(0)
                if not is_suspect(name):
                    continue
                out.append((name, line_of(text, base + match.start()),
                            "embedded-sql", "suspect"))
    return out


def scan(path: Path, root: str) -> list[Finding]:
    text = path.read_text(encoding="utf-8", errors="replace")
    findings: list[Finding] = []
    for name, line, kind, tier in scan_struct_tags_v2(text) + scan_embedded_sql_v2(text):
        level = "error" if tier == "forbidden" else "warning"
        findings.append(Finding(
            rule_id=RULE.id,
            level=level,
            message=format_message(name, tier=tier, source_kind=kind),
            file_path=relpath(path, root),
            start_line=line,
        ))
    return findings


def main() -> int:
    args = build_parser("BOOL-NEG-001 boolean-column-negative (go)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-boolean-column-negative-go",
        tool_version="2.0.0",
        rules=[RULE],
    )
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=_globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
