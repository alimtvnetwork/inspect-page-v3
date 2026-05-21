"""Test-only import shim for BOOL-NEG-001 Go scanner.

Loads `checks/boolean-column-negative/go.py` via importlib.util because
the hyphenated folder name is not a valid Python module identifier.
Re-exports the scanning primitives so unit tests can call them directly
without going through the SARIF emitter.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
_GO_PATH = _HERE / "boolean-column-negative" / "go.py"

_spec = importlib.util.spec_from_file_location("_bool_neg_go", _GO_PATH)
if _spec is None or _spec.loader is None:  # pragma: no cover
    raise ImportError(f"Cannot load BOOL-NEG-001 Go module from {_GO_PATH}")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)


def scan_text(text: str) -> list[dict[str, Any]]:
    """Run both struct-tag + embedded-SQL scanners and return plain dicts."""
    findings: list[dict[str, Any]] = []
    for name, line, kind in _mod.scan_struct_tags(text) + _mod.scan_embedded_sql(text):
        findings.append({
            "rule_id": "BOOL-NEG-001",
            "column": name,
            "line": line,
            "kind": kind,
        })
    return findings


def is_violation(name: str) -> bool:
    return _mod.is_violation(name)


def snake_to_pascal(snake: str) -> str:
    return _mod.snake_to_pascal(snake)
