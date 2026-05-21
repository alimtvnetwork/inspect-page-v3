#!/usr/bin/env python3
"""CODE-RED-002 — Boolean naming. TypeScript / JavaScript."""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _lib.cli import build_parser, parse_exclude_paths
from _lib.sarif import Finding, Rule, SarifRun, emit
from _lib.walker import relpath, walk_files


RULE = Rule(
    id="CODE-RED-002",
    name="BooleanNaming",
    short_description="Boolean identifiers must start with is, has, can, should, was, or will.",
    help_uri_relative="01-cross-language/02-boolean-principles/00-overview.md",
)
PREFIXES = ("is", "has", "can", "should", "was", "will", "Is", "Has", "Can", "Should", "Was", "Will")
# const|let|var X: boolean = ...   |   const X = true|false
TYPED_RE = re.compile(r"\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*boolean\b")
LITERAL_RE = re.compile(r"\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:true|false)\b")


def strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    src = re.sub(r"//[^\n]*", "", src)
    return src


def has_valid_prefix(name: str) -> bool:
    return any(name.startswith(p) for p in PREFIXES) or name == "_"


def scan(path: Path, root: str) -> list[Finding]:
    findings: list[Finding] = []
    text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
    for i, line in enumerate(text.splitlines(), start=1):
        for m in list(TYPED_RE.finditer(line)) + list(LITERAL_RE.finditer(line)):
            name = m.group(1)
            if not has_valid_prefix(name):
                findings.append(
                    Finding(
                        rule_id=RULE.id,
                        level="error",
                        message=f"Boolean '{name}' must start with is/has/can/should/was/will.",
                        file_path=relpath(path, root),
                        start_line=i,
                        start_column=m.start(1) + 1,
                    )
                )
    return findings


def main() -> int:
    args = build_parser("CODE-RED-002 boolean-naming (TS/JS)").parse_args()
    _globs = parse_exclude_paths(args.exclude_paths)
    run = SarifRun(tool_name="coding-guidelines-boolean-naming-ts", tool_version="1.0.0", rules=[RULE])
    for f in walk_files(args.path, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], exclude_globs=_globs):
        for finding in scan(f, args.path):
            run.add(finding)
    return emit(run, args.format, args.output)


if __name__ == "__main__":
    sys.exit(main())
