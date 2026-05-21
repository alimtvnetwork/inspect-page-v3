#!/usr/bin/env python3
"""BOOL-NEG-001 — Forbid Not/No-prefixed boolean DB column names (SQL).

Two-tier detection:
  Tier 1 (error)   — Is/Has + Not/No prefix (IsNotActive, HasNoLicense).
  Tier 2 (warning) — suspect single-negative roots (Cannot*, Dis*, Un*).
                     Allow-listed approved inverses (IsDisabled, IsHidden,
                     IsUnverified, ...) are never flagged.

Each finding includes a replacement hint generated from the codegen
inversion table when one is available, so the linter and Rule 9 codegen
always agree on the canonical form.

Scope: ``.sql`` files and any file under a path segment named
``migrations``/``migration``. Embedded SQL inside Go is handled by the
sibling ``go.py`` scanner (see Task #02 / v4.13.0).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.boolean_naming import (  # noqa: E402
    NEG_PREFIX_RE, SUSPECT_ROOT_RE, format_message,
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
        "(e.g. IsNotActive, HasNoLicense). Use the positive form or "
        "store one canonical state and derive the inverse in code. "
        "Suspect Cannot*/Dis*/Un* roots are flagged as warnings."
    ),
    help_uri_relative="../04-database-conventions/01-naming-conventions.md",
)

EXTENSIONS = [".sql"]
MIGRATION_HINTS = ("migrations", "migration")

CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE[^\(]*\((?P<body>.*?)\)\s*;",
    re.IGNORECASE | re.DOTALL,
)


def is_in_scope(path: Path) -> bool:
    if path.suffix.lower() in EXTENSIONS:
        return True
    parts = {p.lower() for p in path.parts}
    return any(hint in parts for hint in MIGRATION_HINTS) and path.suffix.lower() in {".sql"}


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def scan(path: Path, root: str) -> list[Finding]:
    text = path.read_text(encoding="utf-8", errors="replace")
    findings: list[Finding] = []
    for block in CREATE_TABLE_RE.finditer(text):
        body = block.group("body")
        body_offset = block.start("body")
        findings.extend(_scan_tier1(body, body_offset, text, path, root))
        findings.extend(_scan_tier2(body, body_offset, text, path, root))
    return findings


def _scan_tier1(body: str, body_offset: int, text: str,
                path: Path, root: str) -> list[Finding]:
    out: list[Finding] = []
    for match in NEG_PREFIX_RE.finditer(body):
        name = match.group(1)
        if not is_forbidden(name):
            continue
        out.append(Finding(
            rule_id=RULE.id,
            level="error",
            message=format_message(name, tier="forbidden"),
            file_path=relpath(path, root),
            start_line=_line_of(text, body_offset + match.start()),
        ))
    return out


def _scan_tier2(body: str, body_offset: int, text: str,
                path: Path, root: str) -> list[Finding]:
    out: list[Finding] = []
    for match in SUSPECT_ROOT_RE.finditer(body):
        name = match.group(0)
        if not is_suspect(name):
            continue
        out.append(Finding(
            rule_id=RULE.id,
            level="warning",
            message=format_message(name, tier="suspect"),
            file_path=relpath(path, root),
            start_line=_line_of(text, body_offset + match.start()),
        ))
    return out


def main() -> int:
    args = build_parser("BOOL-NEG-001 boolean-column-negative (sql)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-boolean-column-negative",
        tool_version="2.0.0",
        rules=[RULE],
    )
    for f in walk_files(args.path, EXTENSIONS, exclude_globs=_globs):
        if not is_in_scope(f):
            continue
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
