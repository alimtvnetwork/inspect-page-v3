"""Canonical Is*/Has* → inverse name table (Rule 9, naming-conventions v3.3.0).

If a field is not in the explicit table, we fall back to inserting ``Not``
or ``No`` after the prefix:
    IsFoo  → IsNotFoo
    HasFoo → HasNoFoo

Symmetric pairs are intentional: invert(invert(x)) == x.
"""

from __future__ import annotations

# Forward direction: positive canonical → negative derived.
# Forward direction: positive canonical → approved-inverse derived.
# Mirrors the Rule 8 + Rule 9 tables in
# spec/04-database-conventions/01-naming-conventions.md (v3.4.0).
_FORWARD: dict[str, str] = {
    "IsActive": "IsInactive",
    "IsEnabled": "IsDisabled",
    "IsValid": "IsInvalid",
    "IsComplete": "IsIncomplete",
    "IsAvailable": "IsUnavailable",
    "IsRead": "IsUnread",
    "IsVisible": "IsHidden",
    "IsWorking": "IsBroken",
    "IsUnlocked": "IsLocked",
    "IsVerified": "IsUnverified",
    "IsPublished": "IsUnpublished",
    # Domain-specific inverses (preferred over Has-No-* fallbacks):
    "HasAccess": "IsUnauthorized",
    "HasChildren": "IsSingle",
    # Fallback: no domain term exists, so we generate Has-No-* in code only.
    "HasLicense": "HasNoLicense",
}

# Build the reverse direction automatically so the table is symmetric.
_REVERSE: dict[str, str] = {v: k for k, v in _FORWARD.items()}
_TABLE: dict[str, str] = {**_FORWARD, **_REVERSE}


def invert_name(name: str) -> str:
    if name in _TABLE:
        return _TABLE[name]
    return _fallback(name)


def _fallback(name: str) -> str:
    if name.startswith("Is") and len(name) > 2 and name[2].isupper():
        return f"Is Not{name[2:]}".replace(" ", "")
    if name.startswith("Has") and len(name) > 3 and name[3].isupper():
        return f"Has No{name[3:]}".replace(" ", "")
    return name + "Inverse"
