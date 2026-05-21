#!/usr/bin/env python3
"""SQLI-RAW-002 — whereRaw() must use strict ? / :param placeholders (TS)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths  # noqa: E402
from _lib.sarif import Finding, Rule, SarifRun, emit  # noqa: E402
from _lib.walker import relpath, walk_files  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _shared import (  # noqa: E402
    WHERE_RAW_CALL_RE, diagnose_where_raw, first_arg_span,
    has_placeholders, second_arg_present,
)

RULE = Rule(
    id="SQLI-RAW-002",
    name="WhereRawWithoutStrictParams",
    short_description=(
        "whereRaw() must use only ? or :name placeholders and pass "
        "values via the params array; interpolation and concatenation "
        "are forbidden."
    ),
    help_uri_relative="../18-wp-plugin-how-to/19-micro-orm-and-root-db.md",
)


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def scan(path: Path, root: str):
    text = path.read_text(encoding="utf-8", errors="replace")
    findings = []
    for m in WHERE_RAW_CALL_RE.finditer(text):
        span = first_arg_span(text, m.end())
        if span is None:
            continue
        arg = text[span[0]:span[1]]
        reason, level = diagnose_where_raw(arg)
        if reason is not None:
            findings.append(Finding(
                rule_id=RULE.id, level=level,
                message=f"whereRaw() {reason}.",
                file_path=relpath(path, root),
                start_line=_line_of(text, m.start()),
            ))
            continue
        if not has_placeholders(arg) and not second_arg_present(text, span[1]):
            findings.append(Finding(
                rule_id=RULE.id, level="warning",
                message=(
                    "whereRaw() has no ? or :param placeholders and no "
                    "params array — confirm the clause has zero dynamic "
                    "values, otherwise use the typed where() builder."
                ),
                file_path=relpath(path, root),
                start_line=_line_of(text, m.start()),
            ))
    return findings


def main() -> int:
    args = build_parser("SQLI-RAW-002 whereRaw strict params (TS/JS)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-sqli-where-raw-ts",
        tool_version="1.0.0", rules=[RULE],
    )
    for f in walk_files(args.path, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
