#!/usr/bin/env python3
"""Inverted-field codegen — Rule 9 (spec/04-database-conventions/01-naming-conventions.md).

Given a source file containing a Go struct, PHP class, or TypeScript class
with ``Is*``/``Has*`` db-tagged fields, emit the inverted computed-property
siblings into a generated companion file.

Contract (Rule 9):
  1. Detect every boolean field matching ^(Is|Has)[A-Z][A-Za-z]+$ that has
     a `db:"…"` tag (Go) / @db('…') attribute (PHP) / `db: '…'` decorator
     metadata or DbField marker (TypeScript).
  2. Emit a derived sibling using the canonical inversion table; fall back
     to inserting `Not`/`No` after the prefix when no canonical mapping
     exists.
  3. Never persist the derived field — emit it as a getter / method only.
  4. Never overwrite the source file. Always write to ``<basename>.generated.<ext>``.

Usage:
    python3 inverted_fields.py --input User.go        --lang go
    python3 inverted_fields.py --input User.php       --lang php
    python3 inverted_fields.py --input User.ts        --lang typescript
    python3 inverted_fields.py --input User.go        --lang go --stdout
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from emitters import go_emitter, php_emitter, ts_emitter
from inversion_table import invert_name
from parsers import go_parser, php_parser, ts_parser


@dataclass(frozen=True)
class BooleanField:
    """A db-tagged boolean field discovered in a source struct/class."""
    name: str            # e.g. "IsActive"
    db_column: str       # e.g. "IsActive" — value of the db tag
    inverse: str         # e.g. "IsInactive" — derived per inversion table


@dataclass(frozen=True)
class TypeBlock:
    """A struct (Go) or class (PHP/TS) discovered in the source."""
    type_name: str       # e.g. "User"
    fields: tuple[BooleanField, ...]


LANGS = {
    "go": (go_parser, go_emitter, ".go"),
    "php": (php_parser, php_emitter, ".php"),
    "typescript": (ts_parser, ts_emitter, ".ts"),
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Rule 9 inverted-field codegen")
    p.add_argument("--input", required=True, help="Source file with the struct/class")
    p.add_argument("--lang", required=True, choices=sorted(LANGS.keys()))
    p.add_argument("--stdout", action="store_true", help="Print to stdout instead of writing a file")
    p.add_argument(
        "--output",
        default=None,
        help="Override output path (default: <basename>.generated.<ext>)",
    )
    return p.parse_args()


def discover_blocks(source: str, lang: str) -> list[TypeBlock]:
    parser = LANGS[lang][0]
    raw = parser.parse(source)
    blocks: list[TypeBlock] = []
    for type_name, raw_fields in raw:
        fields = tuple(
            BooleanField(name=name, db_column=column, inverse=invert_name(name))
            for name, column in raw_fields
        )
        if fields:
            blocks.append(TypeBlock(type_name=type_name, fields=fields))
    return blocks


def emit_output(blocks: list[TypeBlock], lang: str) -> str:
    emitter = LANGS[lang][1]
    return emitter.render(blocks)


def resolve_output_path(input_path: Path, lang: str, override: str | None) -> Path:
    if override:
        return Path(override)
    ext = LANGS[lang][2]
    return input_path.with_suffix(f".generated{ext}")


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    source = input_path.read_text(encoding="utf-8")
    blocks = discover_blocks(source, args.lang)
    if not blocks:
        sys.stderr.write(f"⚠️  No Is*/Has* db-tagged fields found in {input_path}\n")
        return 0
    output = emit_output(blocks, args.lang)
    if args.stdout:
        sys.stdout.write(output)
        return 0
    out_path = resolve_output_path(input_path, args.lang, args.output)
    out_path.write_text(output, encoding="utf-8")
    total = sum(len(b.fields) for b in blocks)
    sys.stderr.write(
        f"✅ Wrote {out_path} — {len(blocks)} type(s), {total} inverted field(s)\n"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
