#!/usr/bin/env python3
"""Round-trip tests for the codegen inversion table (Task #04).

Asserts the contract documented in
``linters-cicd/codegen/inversion_table.py`` and
``spec/04-database-conventions/01-naming-conventions.md`` (Rule 9):

1.  **Bijection on the explicit table** — every (positive, negative)
    pair in ``_FORWARD`` must satisfy ``invert(invert(x)) == x`` in
    BOTH directions. This is the strongest guarantee codegen relies
    on: emitted derived siblings can be re-inverted back to the
    canonical persisted column without lookup ambiguity.

2.  **No collisions** — no positive name maps to the same negative as
    another positive (and vice-versa). A collision would silently
    overwrite an entry when ``_REVERSE`` is built.

3.  **No self-inverse** — ``invert(x) != x`` for every entry.

4.  **Fallback shape** — unknown ``Is*``/``Has*`` names get
    ``Not``/``No`` inserted after the prefix. Fallback is **one-way
    by design**: ``IsFoo → IsNotFoo`` but ``IsNotFoo → IsNotNotFoo``
    (no double-negative collapse). This test locks that contract so
    future "smart fallback" rewrites must update the docs first.

5.  **Allow-list lock-step** — every BOOL-NEG-001 allow-listed name
    appears as a value somewhere in ``_FORWARD``, so the linter's
    "approved single-negative" set and codegen's "canonical inverse"
    set are guaranteed to agree.

Run via ``python3 linters-cicd/tests/run.py`` or
``python3 -m unittest linters-cicd.tests.test_codegen_inversion_table``.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "codegen"))

from inversion_table import (  # noqa: E402  (sys.path setup above)
    _FORWARD, _REVERSE, _TABLE, invert_name,
)


# Mirrors BOOL-NEG-001 sql.py + go.py allow-list. If this drifts, both
# scanners and codegen are out of sync — surface immediately.
BOOL_NEG_ALLOWLIST = {
    "IsDisabled", "IsInvalid", "IsIncomplete", "IsUnavailable",
    "IsUnread", "IsHidden", "IsBroken", "IsLocked",
    "IsUnpublished", "IsUnverified",
}


class TestExplicitTableBijection(unittest.TestCase):
    """Every (positive, negative) pair must round-trip in both directions."""

    def test_forward_then_reverse_returns_original(self) -> None:
        for positive in _FORWARD:
            with self.subTest(positive=positive):
                negative = invert_name(positive)
                round_trip = invert_name(negative)
                self.assertEqual(
                    round_trip, positive,
                    f"{positive} -> {negative} -> {round_trip} (expected {positive})",
                )

    def test_reverse_then_forward_returns_original(self) -> None:
        for negative in _REVERSE:
            with self.subTest(negative=negative):
                positive = invert_name(negative)
                round_trip = invert_name(positive)
                self.assertEqual(
                    round_trip, negative,
                    f"{negative} -> {positive} -> {round_trip} (expected {negative})",
                )

    def test_combined_table_size_is_double_forward(self) -> None:
        # _TABLE = _FORWARD ∪ _REVERSE. If any positive collides with
        # any negative, the merged dict shrinks below 2 * len(_FORWARD).
        self.assertEqual(
            len(_TABLE), 2 * len(_FORWARD),
            "Positive/negative key collision detected in _TABLE merge",
        )


class TestNoCollisions(unittest.TestCase):
    """No two positives may share a negative; no two negatives a positive."""

    def test_negatives_are_unique(self) -> None:
        negatives = list(_FORWARD.values())
        duplicates = [n for n in set(negatives) if negatives.count(n) > 1]
        self.assertEqual(duplicates, [],
                         f"Duplicate negatives in _FORWARD: {duplicates}")

    def test_positives_are_unique(self) -> None:
        # Trivially true (dict keys), but explicit guards against future
        # multi-line append bugs that copy-paste a key.
        self.assertEqual(len(_FORWARD), len(set(_FORWARD.keys())))

    def test_no_positive_equals_any_negative(self) -> None:
        overlap = set(_FORWARD.keys()) & set(_FORWARD.values())
        self.assertEqual(overlap, set(),
                         f"Names appear as both positive and negative: {overlap}")


class TestNoSelfInverse(unittest.TestCase):
    def test_no_entry_inverts_to_itself(self) -> None:
        for name in _TABLE:
            with self.subTest(name=name):
                self.assertNotEqual(invert_name(name), name)


class TestFallbackContract(unittest.TestCase):
    """Fallback is intentionally one-way; tests pin that documented behavior."""

    def test_is_prefix_inserts_not(self) -> None:
        self.assertEqual(invert_name("IsFoo"), "IsNotFoo")
        self.assertEqual(invert_name("IsCustomThing"), "IsNotCustomThing")

    def test_has_prefix_inserts_no(self) -> None:
        self.assertEqual(invert_name("HasBar"), "HasNoBar")
        self.assertEqual(invert_name("HasCustomThing"), "HasNoCustomThing")

    def test_fallback_does_not_collapse_double_negative(self) -> None:
        # Documented one-way fallback: re-inverting a fallback result
        # produces "NotNot"/"NoNo". This is by design — do not "fix"
        # without updating spec/04-database-conventions/01-...md Rule 9.
        self.assertEqual(invert_name("IsNotFoo"), "IsNotNotFoo")
        self.assertEqual(invert_name("HasNoBar"), "HasNoNoBar")

    def test_unknown_non_is_has_prefix_gets_inverse_suffix(self) -> None:
        self.assertEqual(invert_name("Active"), "ActiveInverse")
        self.assertEqual(invert_name("CanEdit"), "CanEditInverse")

    def test_short_is_has_passes_through_safely(self) -> None:
        # "Is" alone (no PascalCase suffix) shouldn't crash; fallback
        # for unknowns appends "Inverse".
        self.assertEqual(invert_name("Is"), "IsInverse")
        self.assertEqual(invert_name("Has"), "HasInverse")


class TestBoolNegAllowListLockstep(unittest.TestCase):
    """Every BOOL-NEG-001 allow-listed name must appear as an inverse."""

    def test_every_allowlisted_name_is_a_canonical_inverse(self) -> None:
        canonical_inverses = set(_FORWARD.values())
        missing = BOOL_NEG_ALLOWLIST - canonical_inverses
        self.assertEqual(
            missing, set(),
            f"Allow-listed names not present as inverses in _FORWARD: "
            f"{sorted(missing)}. Either add them to the inversion table "
            f"or remove from the BOOL-NEG-001 allow-list.",
        )


class TestDeterminism(unittest.TestCase):
    """Same input → same output, every call. Codegen must not be flaky."""

    def test_repeated_invocation_is_stable(self) -> None:
        for name in list(_TABLE.keys()) + ["IsFoo", "HasBar", "Active"]:
            with self.subTest(name=name):
                first = invert_name(name)
                for _ in range(5):
                    self.assertEqual(invert_name(name), first)


if __name__ == "__main__":
    unittest.main(verbosity=2)
