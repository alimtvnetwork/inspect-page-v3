"""PHP class parser — extracts Is*/Has* bool properties with #[Db('…')].

Recognized field shape:
    #[Db('IsActive')]
    public bool $IsActive;

Returns: list of (class_name, [(field_name, db_column), ...]).
"""

from __future__ import annotations

import re

_CLASS_RE = re.compile(
    r"class\s+(?P<name>[A-Z][A-Za-z0-9_]*)\s*\{(?P<body>.*?)^\}",
    re.DOTALL | re.MULTILINE,
)
_FIELD_RE = re.compile(
    r"#\[Db\(['\"](?P<col>[^'\"]+)['\"]\)\]\s*"
    r"public\s+bool\s+\$(?P<field>(?:Is|Has)[A-Z][A-Za-z0-9]*)\s*;",
)


def parse(source: str) -> list[tuple[str, list[tuple[str, str]]]]:
    blocks: list[tuple[str, list[tuple[str, str]]]] = []
    for cls in _CLASS_RE.finditer(source):
        class_name = cls.group("name")
        body = cls.group("body")
        fields = [(m.group("field"), m.group("col")) for m in _FIELD_RE.finditer(body)]
        blocks.append((class_name, fields))
    return blocks
