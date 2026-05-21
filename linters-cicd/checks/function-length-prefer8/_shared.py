"""CODE-RED-005 — shared helpers for the STRICT 8-line function-length check.

**Canonical specification (threshold + counting rules):**
``linters-cicd/checks/function-length-prefer8/README.md``

That README is the single source of truth. This module is the
**executable** mirror — if the two ever disagree it is a P1 bug; fix
the README first, then bring this module into alignment.

Per ``.lovable/coding-guidelines/coding-guidelines.md`` rule #1
("Keep functions under 8 lines"), this rule emits SARIF ``error``
findings on ANY function body whose effective line count exceeds 8.

CODE-RED-004 (``checks/function-length/``) remains as a redundant
>15-line safety net at the same severity. The two rules form a
coordinated tier and do not contradict:

  * 0–8 effective lines  → both rules silent
  * 9–15 effective lines → CODE-RED-005 errors  (CODE-RED-004 silent)
  * 16+ effective lines  → both rules error

Sibling CODE-RED-004 modules live in ``checks/function-length/`` whose
hyphenated path is not importable directly; ``load_sibling`` loads them
by file path so we can reuse their regex patterns and counters.

The historical ``is_in_prefer_band`` helper (returned True only for the
9–15 band) is kept for backwards-compat with any external callers, but
the in-tree scanners now use ``exceeds_strict_cap`` instead.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

from _lib.sarif import Finding, Rule
from _lib.walker import relpath


STRICT_LINES = 8
LEGACY_HARD_LINES = 15  # owned by CODE-RED-004; kept here for docs only.

RULE = Rule(
    id="CODE-RED-005",
    name="FunctionLengthPrefer8",
    short_description="Functions must not exceed 8 effective lines (strict).",
    help_uri_relative="01-cross-language/04-code-style/00-overview.md",
)


def load_sibling(language: str) -> ModuleType:
    here = Path(__file__).resolve().parent.parent
    target = here / "function-length" / f"{language}.py"
    spec = importlib.util.spec_from_file_location(f"_fl_{language}", target)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load sibling module: {target}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def exceeds_strict_cap(effective: int) -> bool:
    return effective > STRICT_LINES


def is_in_prefer_band(effective: int) -> bool:
    """Deprecated. Retained for backwards-compat; prefer ``exceeds_strict_cap``."""
    return effective > STRICT_LINES and effective <= LEGACY_HARD_LINES


def make_finding(name: str, effective: int, path: Path, root: str, start_line: int) -> Finding:
    msg = (
        f"Function '{name}' has {effective} effective lines "
        f"(strict cap {STRICT_LINES})."
    )
    return Finding(
        rule_id=RULE.id,
        level="error",
        message=msg,
        file_path=relpath(path, root),
        start_line=start_line,
    )
