#!/usr/bin/env python3
"""Tests for the shared boolean_naming library (Task #07).

Locks the v2 contract for ``linters-cicd/checks/_lib/boolean_naming.py``:

- Tier 1 forbidden detection (Is/Has + Not/No)
- Tier 2 suspect detection (Cannot*, Dis*, Un*)
- Allow-list takes precedence in BOTH tiers
- Replacement hints come from the codegen inversion table; fallback
  hints handle Cannot* by stripping the prefix; useless "NotNot" hints
  are suppressed
- format_message() never raises on known tiers and rejects unknown ones
- Lock-step: the linter allow-list is a subset of the codegen
  inversion-table values (same assertion as v4.14.0 #04, but enforced
  from the linter side this time)

Run via ``python3 linters-cicd/tests/run.py``.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "checks"))

from _lib.boolean_naming import (  # noqa: E402
    ALLOWLIST, _FORWARD, format_message,
    is_forbidden, is_suspect, replacement_hint,
)


class TestTier1Forbidden(unittest.TestCase):
    def test_is_not_prefix_forbidden(self) -> None:
        for n in ("IsNotActive", "IsNotVerified", "IsNotPublished"):
            with self.subTest(n=n):
                self.assertTrue(is_forbidden(n))

    def test_has_no_prefix_forbidden(self) -> None:
        for n in ("HasNoAccess", "HasNoLicense", "HasNoChildren"):
            with self.subTest(n=n):
                self.assertTrue(is_forbidden(n))

    def test_positive_forms_clean(self) -> None:
        for n in ("IsActive", "HasLicense", "IsVerified"):
            with self.subTest(n=n):
                self.assertFalse(is_forbidden(n))


class TestTier2Suspect(unittest.TestCase):
    def test_cannot_prefix_suspect(self) -> None:
        for n in ("CannotEdit", "CannotDelete", "CannotPublish"):
            with self.subTest(n=n):
                self.assertTrue(is_suspect(n))

    def test_dis_root_suspect(self) -> None:
        for n in ("DisabledFlag", "DisallowedAccess", "DisconnectedNode"):
            with self.subTest(n=n):
                self.assertTrue(is_suspect(n))

    def test_un_root_suspect(self) -> None:
        for n in ("Unread", "Unverified", "Unpublished"):
            with self.subTest(n=n):
                self.assertTrue(is_suspect(n))


class TestAllowListPrecedence(unittest.TestCase):
    """Approved single-negatives must NEVER be flagged in either tier."""

    def test_allowlisted_clean_in_both_tiers(self) -> None:
        for n in ALLOWLIST:
            with self.subTest(n=n):
                self.assertFalse(is_forbidden(n),
                                 f"'{n}' is allow-listed; must not be forbidden")
                self.assertFalse(is_suspect(n),
                                 f"'{n}' is allow-listed; must not be suspect")


class TestNoTierOverlap(unittest.TestCase):
    """A name is at most one tier — never both forbidden AND suspect."""

    def test_no_overlap(self) -> None:
        samples = [
            "IsNotActive", "HasNoLicense",                        # forbidden
            "CannotEdit", "DisabledFlag", "Unread",               # suspect
            "IsActive", "HasLicense",                             # clean
        ] + sorted(ALLOWLIST)                                      # allow-listed
        for n in samples:
            with self.subTest(n=n):
                self.assertFalse(is_forbidden(n) and is_suspect(n),
                                 f"'{n}' classified as both tiers")


class TestReplacementHints(unittest.TestCase):
    def test_table_hint_returns_canonical_inverse(self) -> None:
        # Inversion table provides exact pairs.
        self.assertEqual(replacement_hint("IsInactive"), "IsActive")
        self.assertEqual(replacement_hint("IsDisabled"), "IsEnabled")
        self.assertEqual(replacement_hint("HasNoLicense"), "HasLicense")

    def test_isnot_prefix_stripped_to_positive(self) -> None:
        # The most common Tier 1 case — strip Not/No directly.
        self.assertEqual(replacement_hint("IsNotActive"), "IsActive")
        self.assertEqual(replacement_hint("IsNotVerified"), "IsVerified")
        self.assertEqual(replacement_hint("HasNoAccess"), "HasAccess")

    def test_cannot_hint_strips_prefix(self) -> None:
        self.assertEqual(replacement_hint("CannotEdit"), "CanEdit")
        self.assertEqual(replacement_hint("CannotDelete"), "CanDelete")

    def test_unknown_root_returns_none(self) -> None:
        # Names with no Is/Has/Cannot prefix and no table entry — no
        # safe rename to suggest, so None is the contract.
        self.assertIsNone(replacement_hint("Active"))
        self.assertIsNone(replacement_hint("RandomThing"))



class TestFormatMessage(unittest.TestCase):
    def test_forbidden_includes_hint(self) -> None:
        msg = format_message("IsInactive", tier="forbidden")
        self.assertIn("IsInactive", msg)
        self.assertIn("IsActive", msg)
        self.assertIn("Rule 9", msg)

    def test_suspect_includes_hint(self) -> None:
        msg = format_message("CannotEdit", tier="suspect")
        self.assertIn("CannotEdit", msg)
        self.assertIn("CanEdit", msg)
        self.assertIn("Rule 8", msg)

    def test_message_includes_source_kind_when_provided(self) -> None:
        msg = format_message("IsNotActive", tier="forbidden", source_kind="db-tag")
        self.assertIn("db-tag", msg)

    def test_unknown_tier_raises(self) -> None:
        with self.assertRaises(ValueError):
            format_message("X", tier="bogus")


class TestLockstepWithCodegen(unittest.TestCase):
    """Linter allow-list ⊆ codegen canonical inverses. Mirrors the
    assertion in test_codegen_inversion_table.py but enforced from the
    linter's perspective so a one-sided edit fails immediately."""

    def test_allowlist_is_subset_of_canonical_inverses(self) -> None:
        canonical_inverses = set(_FORWARD.values())
        missing = set(ALLOWLIST) - canonical_inverses
        self.assertEqual(
            missing, set(),
            f"Linter allow-list contains names not in codegen "
            f"_FORWARD values: {sorted(missing)}",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
