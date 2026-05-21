"""Shared boolean-naming primitives for BOOL-NEG-001 (sql + go scanners).

Single source of truth for:
- The forbidden Not/No prefix regex (Tier 1 — error).
- The suspect Cannot/Dis/Un single-negative root regex (Tier 2 — warning).
- The allow-list of approved single-negative names.
- The replacement-hint generator backed by the codegen inversion table.

Centralizing these here means the SQL and Go scanners cannot drift on
what counts as a violation or what hint they suggest. Tests in
``linters-cicd/tests/test_boolean_naming_lib.py`` lock the contract.

Spec: spec/04-database-conventions/01-naming-conventions.md  Rules 2, 8, 9
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# Reach the codegen package so we can reuse the canonical inversion table
# (single source of truth across linter + codegen).
_CODEGEN_DIR = Path(__file__).resolve().parents[2] / "codegen"
if str(_CODEGEN_DIR) not in sys.path:
    sys.path.insert(0, str(_CODEGEN_DIR))

from inversion_table import _FORWARD, invert_name  # noqa: E402


# ---------------------------------------------------------------------------
# Tier 1 — Forbidden Not/No prefixes (error). Must match in SQL + Go.
# ---------------------------------------------------------------------------
NEG_PREFIX_RE = re.compile(r"\b((?:Is|Has)(?:Not|No)[A-Z][A-Za-z0-9]*)\b")


# ---------------------------------------------------------------------------
# Tier 2 — Suspect single-negative roots (warning). Catches the common
# anti-patterns that slipped through v1: Cannot*, Dis*, Un*. We keep the
# regex strict (PascalCase boundary, anchored prefix) to minimize false
# positives on legitimate substrings like "Disable" inside other words.
# ---------------------------------------------------------------------------
SUSPECT_ROOT_RE = re.compile(
    r"\b(?:"
    r"Cannot[A-Z][A-Za-z0-9]*"             # CannotEdit, CannotDelete
    r"|(?:Is|Has)?Dis(?:abled|allowed|connected)[A-Za-z0-9]*"  # IsDisabled, DisabledFlag
    r"|(?:Is|Has)?Un[a-z]+[A-Z]?[A-Za-z0-9]*"                  # IsUnverified, Unread
    r")\b"
)

# ---------------------------------------------------------------------------
# Approved single-negative names. Same set used by sql.py / go.py / codegen.
# ---------------------------------------------------------------------------
ALLOWLIST: frozenset[str] = frozenset({
    "IsDisabled", "IsInvalid", "IsIncomplete", "IsUnavailable",
    "IsUnread", "IsHidden", "IsBroken", "IsLocked",
    "IsUnpublished", "IsUnverified",
})


def is_forbidden(name: str) -> bool:
    """True iff *name* matches the Tier 1 forbidden Not/No regex and is
    not on the allow-list."""
    if name in ALLOWLIST:
        return False
    return NEG_PREFIX_RE.fullmatch(name) is not None


def is_suspect(name: str) -> bool:
    """True iff *name* matches the Tier 2 suspect-root regex and is
    neither allow-listed nor already a Tier 1 violation."""
    if name in ALLOWLIST:
        return False
    if is_forbidden(name):
        return False
    return SUSPECT_ROOT_RE.fullmatch(name) is not None


def replacement_hint(name: str) -> str | None:
    """Return the recommended canonical name, or None when no useful hint
    can be derived. Backed by the codegen inversion table so the linter
    and the Rule 9 codegen always agree on canonical forms.
    """
    # Strip Is/Not + Has/No prefixes — the most common Tier 1 case
    # (IsNotActive → IsActive, HasNoLicense → HasLicense). Then check
    # the inversion table to surface the canonical pair if one exists.
    if name.startswith("IsNot") and len(name) > 5 and name[5].isupper():
        return "Is" + name[5:]
    if name.startswith("HasNo") and len(name) > 5 and name[5].isupper():
        return "Has" + name[5:]

    # Direct table lookup wins (e.g. IsInactive → IsActive).
    inverted = invert_name(name)
    if inverted != name and not inverted.endswith("Inverse"):
        if "NotNot" in inverted or "NoNo" in inverted:
            return None
        return inverted

    # Cannot* — strip the prefix (CannotEdit → CanEdit) when sensible.
    if name.startswith("Cannot") and len(name) > 6 and name[6].isupper():
        return "Can" + name[6:]

    return None


def format_message(name: str, *, tier: str, source_kind: str | None = None) -> str:
    """Build a uniform message body shared by SQL + Go scanners."""
    hint = replacement_hint(name)
    suffix = f" Suggestion: rename to '{hint}'." if hint else ""
    src = f" ({source_kind})" if source_kind else ""

    if tier == "forbidden":
        return (
            f"Boolean column '{name}' uses a forbidden Not/No prefix{src}.{suffix} "
            "Store the canonical positive form and derive the inverse as a "
            "computed field in code. See Rule 2 + Rule 9 in "
            "04-database-conventions/01-naming-conventions.md."
        )
    if tier == "suspect":
        return (
            f"Boolean column '{name}' uses a suspect single-negative root "
            f"(Cannot/Dis/Un){src}.{suffix} Prefer the positive form unless "
            "the name describes a recognized domain state (see allow-list). "
            "Rule 2 + Rule 8 in 04-database-conventions/01-naming-conventions.md."
        )
    raise ValueError(f"Unknown tier: {tier!r}")


# Re-export so existing imports (`from _lib.boolean_naming import ...`)
# can grab everything from one place.
__all__ = [
    "ALLOWLIST",
    "NEG_PREFIX_RE",
    "SUSPECT_ROOT_RE",
    "format_message",
    "is_forbidden",
    "is_suspect",
    "replacement_hint",
    "_FORWARD",  # exposed for cross-test lock-step assertions
]
