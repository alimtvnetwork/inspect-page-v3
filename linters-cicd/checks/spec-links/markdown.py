#!/usr/bin/env python3
"""SPEC-LINK-001 — Cross-link integrity checker for markdown specs.

Walks every `.md` file under the scan path and verifies that every
**relative** markdown link resolves to an existing file (and, when an
anchor is present, that the target file contains a heading with a
matching GitHub-flavored slug).

Out of scope:
  * External links (`http://`, `https://`, `mailto:`, `tel:`, `ftp://`).
    SPEC-LINK-001 does not make network calls — link rot in external
    URLs is a separate problem.
  * Setext headings (`Foo\\n===`). The spec uses ATX exclusively.
  * Links inside fenced code blocks (``` or ~~~).

Spec: spec/04-database-conventions/* (cross-link Rule 9 / Rules 10–12)
Naming: SPEC-LINK-001 (warning level — broken cross-refs degrade docs but
        do not block builds; CI may upgrade to error via SARIF rules).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.markdown_links import EXTENSIONS, check_file, is_in_scope
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="SPEC-LINK-001",
    name="BrokenSpecCrossLink",
    short_description=(
        "Every relative markdown link in the spec must resolve to an "
        "existing file; anchored links must point at a heading that "
        "exists in the target file. External links are out of scope."
    ),
    help_uri_relative="../04-database-conventions/01-naming-conventions.md",
)


def scan(path: Path, root: str, slug_cache: dict[Path, set[str]]) -> list[Finding]:
    out: list[Finding] = []
    for broken in check_file(path, root=Path(root), slug_cache=slug_cache):
        out.append(
            Finding(
                rule_id=RULE.id,
                level="error",
                message=broken.message,
                file_path=relpath(path, root),
                start_line=broken.line,
            )
        )
    return out


def main() -> int:
    args = build_parser("SPEC-LINK-001 spec-links (markdown)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(
        tool_name="coding-guidelines-spec-links",
        tool_version="1.1.0",
        rules=[RULE],
    )
    slug_cache: dict[Path, set[str]] = {}
    for f in walk_files(args.path, list(EXTENSIONS), exclude_globs=_globs):
        if not is_in_scope(f):
            continue
        for finding in scan(f, args.path, slug_cache):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
