"""Test-only import shim for BOOL-NEG-001.

The check lives in `checks/boolean-column-negative/sql.py`. The hyphenated
folder name is not a valid Python module identifier, so this shim loads it
via importlib.util and re-exports the scanning primitives in a form unit
tests can call directly (without going through the SARIF emitter).

Production code paths are unaffected: `run-all.sh` invokes the script
directly via `python3 checks/boolean-column-negative/sql.py ...`.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
_SQL_PATH = _HERE / "boolean-column-negative" / "sql.py"

_spec = importlib.util.spec_from_file_location("_bool_neg_sql", _SQL_PATH)
if _spec is None or _spec.loader is None:  # pragma: no cover
    raise ImportError(f"Cannot load BOOL-NEG-001 module from {_SQL_PATH}")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)


def scan_text(text: str) -> list[dict[str, Any]]:
    """Scan SQL text and return a plain-dict finding list for assertions.

    Bypasses file I/O and the SARIF emitter so tests stay fast and
    framework-free. v2: emits both Tier 1 (forbidden) and Tier 2
    (suspect) findings; the original v1 tests only assert on Tier 1
    so they continue to pass unchanged.
    """
    # Pull centralized helpers from the shared library — same source of
    # truth used by sql.py and go.py.
    import sys
    sys.path.insert(0, str(_HERE / "_lib"))
    from boolean_naming import (  # type: ignore[import-not-found]
        NEG_PREFIX_RE, SUSPECT_ROOT_RE, is_forbidden, is_suspect,
    )

    findings: list[dict[str, Any]] = []
    for block in _mod.CREATE_TABLE_RE.finditer(text):
        body = block.group("body")
        body_offset = block.start("body")
        for match in NEG_PREFIX_RE.finditer(body):
            name = match.group(1)
            if not is_forbidden(name):
                continue
            abs_offset = body_offset + match.start()
            findings.append({
                "rule_id": "BOOL-NEG-001",
                "column": name,
                "line": text.count("\n", 0, abs_offset) + 1,
                "tier": "forbidden",
                "message": f"Boolean column '{name}' uses a forbidden Not/No prefix.",
            })
        for match in SUSPECT_ROOT_RE.finditer(body):
            name = match.group(0)
            if not is_suspect(name):
                continue
            abs_offset = body_offset + match.start()
            findings.append({
                "rule_id": "BOOL-NEG-001",
                "column": name,
                "line": text.count("\n", 0, abs_offset) + 1,
                "tier": "suspect",
                "message": f"Boolean column '{name}' uses a suspect single-negative root.",
            })
    return findings

