#!/usr/bin/env python3
"""SQLI-ORDER-001 — orderBy/groupBy identifiers must be literal or allow-listed (PHP).

The micro-ORM only sanitizes column names with a permissive
``[A-Za-z0-9_]+`` regex. That blocks spaces and quotes but not
attacker-chosen column or table names. Any orderBy()/groupBy() call
whose first argument is not a string literal or an allow-list lookup
is flagged.

Spec: spec/18-wp-plugin-how-to/19-micro-orm-and-root-db.md
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths  # noqa: E402
from _lib.sarif import Finding, Rule, SarifRun, emit  # noqa: E402
from _lib.walker import relpath, walk_files  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _shared import (  # noqa: E402
    ORDER_GROUP_CALL_RE, first_arg_span, is_safe_identifier_arg,
)

RULE = Rule(
    id="SQLI-ORDER-001",
    name="UnvalidatedOrderOrGroupByIdentifier",
    short_description=(
        "orderBy/orderByAsc/orderByDesc/groupBy must take a string "
        "literal or an allow-listed column constant; raw variables "
        "or user input are forbidden."
    ),
    help_uri_relative="../18-wp-plugin-how-to/19-micro-orm-and-root-db.md",
)


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def scan(path: Path, root: str):
    text = path.read_text(encoding="utf-8", errors="replace")
    findings = []
    for m in ORDER_GROUP_CALL_RE.finditer(text):
        method = m.group("method")
        span = first_arg_span(text, m.end())
        if span is None:
            continue
        arg = text[span[0]:span[1]]
        if is_safe_identifier_arg(arg):
            continue
        findings.append(Finding(
            rule_id=RULE.id, level="error",
            message=(
                f"{method}() identifier `{arg.strip()[:60]}` is not a "
                f"string literal or allow-listed column constant. "
                f"Validate against an explicit allow-list before "
                f"reaching the builder."
            ),
            file_path=relpath(path, root),
            start_line=_line_of(text, m.start()),
        ))
    return findings


def main() -> int:
    args = build_parser("SQLI-ORDER-001 orderBy/groupBy idents (PHP)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-sqli-order-group-by-php",
        tool_version="1.0.0", rules=[RULE],
    )
    for f in walk_files(args.path, [".php"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
