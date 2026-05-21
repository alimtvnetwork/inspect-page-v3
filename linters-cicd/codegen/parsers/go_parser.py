"""Go struct parser — extracts Is*/Has* bool fields with `db:"…"` tags.

Returns: list of (type_name, [(field_name, db_column), ...]).

This is a **regex parser**, not a full Go AST. Sufficient because Rule 9
fields follow a strict shape: ``IsX bool `db:"IsX"``` on a single line.
"""

from __future__ import annotations

import re

_STRUCT_RE = re.compile(
    r"type\s+(?P<name>[A-Z][A-Za-z0-9_]*)\s+struct\s*\{(?P<body>[^}]*)\}",
    re.DOTALL,
)
_FIELD_RE = re.compile(
    r"^\s*(?P<field>(?:Is|Has)[A-Z][A-Za-z0-9]*)\s+bool\s+`[^`]*\bdb:\"(?P<col>[^\"]+)\"[^`]*`",
    re.MULTILINE,
)


def parse(source: str) -> list[tuple[str, list[tuple[str, str]]]]:
    blocks: list[tuple[str, list[tuple[str, str]]]] = []
    for struct in _STRUCT_RE.finditer(source):
        type_name = struct.group("name")
        body = struct.group("body")
        fields = [(m.group("field"), m.group("col")) for m in _FIELD_RE.finditer(body)]
        blocks.append((type_name, fields))
    return blocks
