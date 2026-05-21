#!/usr/bin/env python3
"""DB-FREETEXT-001 — Require Description / Notes / Comments columns (presence only).

Thin shim over ``_lib/free_text_columns.py``. Presence-only behaviour
preserved for backwards compatibility with v1.0 CI configs.

For full Rule 10/11/12 enforcement (presence + nullability + waivers),
use **MISSING-DESC-001** instead. Both rules share the same classifier
and column-detection logic — they cannot drift apart.

Spec: spec/04-database-conventions/02-schema-design.md §6
Naming: spec/04-database-conventions/01-naming-conventions.md Rules 10/11
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
    id="DB-FREETEXT-001",
    name="FreeTextColumnsRequired",
    short_description=(
        "Entity/reference tables must declare 'Description TEXT NULL'; "
        "transactional tables must declare both 'Notes TEXT NULL' and "
        "'Comments TEXT NULL'. Presence check only — for full Rule 12 "
        "(NOT NULL / DEFAULT) enforcement use MISSING-DESC-001."
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
        for f in scan_text(text, check_nullability=False, rule_id_for_waivers=None)
    ]


def main() -> int:
    args = build_parser("DB-FREETEXT-001 free-text-columns (sql)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-free-text-columns",
        tool_version="1.1.0",
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
