#!/usr/bin/env python3
"""SQLI-RAW-001 — Forbid rawExecute() with concatenated/interpolated SQL (PHP).

The micro-ORM exposes rawExecute(string $sql, array $params = []) as an
escape hatch for queries the builder can't express. The first argument
MUST be a single string literal; all dynamic values MUST flow through
the second argument as bound parameters (:name or ? placeholders).

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
    RAW_EXECUTE_CALL_RE,
    first_arg_span,
    is_unsafe_first_arg,
)

RULE = Rule(
    id="SQLI-RAW-001",
    name="RawExecuteConcatenation",
    short_description=(
        "rawExecute() must take a single literal SQL string; "
        "pass dynamic values via the $params array, never via "
        "concatenation, interpolation, or sprintf."
    ),
    help_uri_relative="../18-wp-plugin-how-to/19-micro-orm-and-root-db.md",
)


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def scan(path: Path, root: str) -> "list[Finding]":
    text = path.read_text(encoding="utf-8", errors="replace")
    findings: "list[Finding]" = []
    for m in RAW_EXECUTE_CALL_RE.finditer(text):
        span = first_arg_span(text, m.end())
        if span is None:
            continue
        arg = text[span[0]:span[1]]
        reason = is_unsafe_first_arg(arg)
        if reason is None:
            continue
        findings.append(
            Finding(
                rule_id=RULE.id,
                level="error",
                message=(
                    f"rawExecute() first arg uses {reason}. "
                    f"Use a literal SQL string with :param placeholders "
                    f"and pass values via the $params array."
                ),
                file_path=relpath(path, root),
                start_line=_line_of(text, m.start()),
            )
        )
    return findings


def main() -> int:
    args = build_parser("SQLI-RAW-001 rawExecute concatenation (PHP)").parse_args()
    globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-sqli-raw-execute-php",
        tool_version="1.0.0",
        rules=[RULE],
    )
    for f in walk_files(args.path, [".php"], exclude_globs=globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
