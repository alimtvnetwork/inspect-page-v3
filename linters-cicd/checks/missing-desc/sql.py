#!/usr/bin/env python3
"""MISSING-DESC-001 — Enforce Description / Notes / Comments contract (full).

Thin shim over ``_lib/free_text_columns.py``:

* Presence checks (Rules 10 / 11) — same classifier as DB-FREETEXT-001
* Nullability check (Rule 12) — flags NOT NULL / DEFAULT on the
  reserved free-text columns.
* Waiver mechanism (v1.1) — per-block `-- linter-waive: MISSING-DESC-001
  reason="..."` and per-file `-- linter-waive-file: ...`.

Spec: spec/04-database-conventions/02-schema-design.md §6 (v3.4.0)
Naming: spec/04-database-conventions/01-naming-conventions.md Rules 10/11/12
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.free_text_columns import EXTENSIONS, is_in_scope, scan_text
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="MISSING-DESC-001",
    name="MissingOrInvalidFreeTextColumns",
    short_description=(
        "Entity tables must declare 'Description TEXT NULL'; transactional "
        "tables must declare both 'Notes TEXT NULL' and 'Comments TEXT NULL'; "
        "and none of these reserved columns may be NOT NULL or carry a "
        "DEFAULT (Rules 10/11/12, schema-design §6). Honours "
        "-- linter-waive: MISSING-DESC-001 reason=\"...\" comments."
    ),
    help_uri_relative="../04-database-conventions/02-schema-design.md",
)


def scan(path: Path, root: str) -> list[Finding]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return [
        Finding(
            rule_id=RULE.id,
            level="error",
            message=f.message,
            file_path=relpath(path, root),
            start_line=f.line,
        )
        for f in scan_text(
            text,
            check_nullability=True,
            rule_id_for_waivers="MISSING-DESC-001",
        )
    ]


def main() -> int:
    args = build_parser("MISSING-DESC-001 missing-desc (sql)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-missing-desc",
        tool_version="1.2.0",
        rules=[RULE],
    )
    for f in walk_files(args.path, list(EXTENSIONS), exclude_globs=_globs):
        if not is_in_scope(f):
            continue
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
