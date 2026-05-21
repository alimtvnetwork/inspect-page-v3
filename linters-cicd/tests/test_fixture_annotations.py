#!/usr/bin/env python3
"""Fixture-annotation validator.

Why this exists
---------------
Every `dirty.<ext>` fixture under `checks/<slug>/fixtures/` documents
its expected findings inline, e.g.:

    var_dump($rows);   // ← TEMPLATE-001 (warning, line 6)

Those comments are the human's mental model of "what the scanner
should find here". When somebody changes the comment/string stripper,
a regex anchor, or a fixture line, the inline annotation and the
scanner output can silently drift apart — the unit test still passes
(it only counts findings) and the README still looks right, but the
fixture is now lying about its own contract.

This test re-parses the annotations on every CI run and asserts:

  * every annotated line appears in the scanner's output, with the
    same rule_id and level
  * no extra findings appear on lines that aren't annotated
  * lines tagged `← NO-FINDING` are silent
  * the line number embedded in the annotation literally equals the
    line the annotation sits on (catches stale "line 6" comments
    after lines move)

Annotation grammar (case-sensitive, single line)
------------------------------------------------
    <prefix> ← <RULE-ID> (<level>, line <N>)
    <prefix> ← NO-FINDING

Where:
  * `<prefix>` is the comment opener for the language (`//`, `#`,
    `--`, `/*`). The validator does not care which.
  * `<RULE-ID>` matches `[A-Z][A-Z0-9-]+` (e.g. `TEMPLATE-001`).
  * `<level>` is one of `error`, `warning`, `note`.
  * `<N>` is the 1-indexed line of the annotation itself.

Adding a new fixture
--------------------
Drop a tuple in `ANNOTATED_FIXTURES` pointing at the check script and
the fixture file. The test discovers everything it needs from there.
"""
from __future__ import annotations

import importlib.util
import re
import sys
import unittest
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ANNOTATION_RE = re.compile(
    r"←\s*(?P<rule>[A-Z][A-Z0-9-]+)\s*"
    r"\(\s*(?P<level>error|warning|note)\s*,\s*"
    r"line\s+(?P<line>\d+)\s*\)"
)
NO_FINDING_RE = re.compile(r"←\s*NO-FINDING\b")
# Any `←` that is not a NO-FINDING tag is treated as a finding
# annotation; if it fails to parse against ANNOTATION_RE we fail
# loudly instead of silently dropping it.
ARROW_RE = re.compile(r"←")

VALID_LEVELS = {"error", "warning", "note"}


@dataclass(frozen=True)
class AnnotatedFixture:
    """A fixture whose expected findings are documented inline."""

    label: str
    script: Path     # checks/<slug>/<lang>.py — must expose scan(path, root)
    fixture: Path    # checks/<slug>/fixtures/<name>.<ext>


# Add a tuple here when a new fixture adopts the annotation convention.
# Keep clean fixtures out of this list — they have nothing to assert
# (silence is already covered by the per-rule unit tests).
ANNOTATED_FIXTURES: tuple[AnnotatedFixture, ...] = (
    AnnotatedFixture(
        label="template_php_dirty",
        script=ROOT / "checks" / "_template" / "php.py",
        fixture=ROOT / "checks" / "_template" / "fixtures" / "dirty.php",
    ),
)


@dataclass(frozen=True)
class _Expectation:
    line: int
    rule_id: str
    level: str


def _load_check(script: Path):
    mod_name = f"_annot_check_{script.parent.name}_{script.stem}"
    spec = importlib.util.spec_from_file_location(mod_name, script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import check script: {script}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = mod
    spec.loader.exec_module(mod)
    if not hasattr(mod, "scan"):
        raise AttributeError(f"{script} must expose scan(path, root)")
    return mod


def _parse_annotations(fixture: Path) -> tuple[list[_Expectation], set[int]]:
    """Return (expected findings, lines explicitly marked NO-FINDING)."""
    expectations: list[_Expectation] = []
    silent_lines: set[int] = set()
    for idx, raw in enumerate(fixture.read_text(encoding="utf-8").splitlines(), start=1):
        m = ANNOTATION_RE.search(raw)
        if m:
            annotated_line = int(m.group("line"))
            if annotated_line != idx:
                raise AssertionError(
                    f"{fixture}:{idx}: annotation says 'line {annotated_line}' "
                    f"but the annotation itself sits on line {idx}. "
                    f"Update the literal to match — or move the violation."
                )
            level = m.group("level")
            if level not in VALID_LEVELS:
                raise AssertionError(
                    f"{fixture}:{idx}: invalid level '{level}'. "
                    f"Use one of {sorted(VALID_LEVELS)}."
                )
            expectations.append(_Expectation(idx, m.group("rule"), level))
            continue
        if NO_FINDING_RE.search(raw):
            silent_lines.add(idx)
            continue
        if ARROW_RE.search(raw):
            raise AssertionError(
                f"{fixture}:{idx}: line contains '←' but does not "
                f"match any annotation grammar. Use either "
                f"'← <RULE-ID> (error|warning|note, line {idx})' or "
                f"'← NO-FINDING'. Raw: {raw.strip()!r}"
            )
    return expectations, silent_lines


class TestFixtureAnnotations(unittest.TestCase):
    """Per-fixture: scanner output must match the inline annotations."""

    def test_fixture_labels_are_unique(self) -> None:
        labels = [f.label for f in ANNOTATED_FIXTURES]
        self.assertEqual(
            len(labels), len(set(labels)),
            "ANNOTATED_FIXTURES labels must be unique"
        )

    def test_at_least_one_annotated_fixture(self) -> None:
        # If this ever drops to zero, the validator is silently a no-op.
        self.assertGreater(len(ANNOTATED_FIXTURES), 0)

    def test_annotations_match_scanner_output(self) -> None:
        for fx in ANNOTATED_FIXTURES:
            with self.subTest(label=fx.label):
                self._verify_one(fx)

    def _verify_one(self, fx: AnnotatedFixture) -> None:
        self.assertTrue(fx.fixture.exists(), f"missing fixture: {fx.fixture}")
        self.assertTrue(fx.script.exists(), f"missing scanner: {fx.script}")

        expected, silent_lines = _parse_annotations(fx.fixture)
        self.assertGreater(
            len(expected), 0,
            f"{fx.fixture}: no annotations parsed. Add at least one "
            f"'← <RULE-ID> (<level>, line N)' comment, or remove the "
            f"fixture from ANNOTATED_FIXTURES."
        )

        mod = _load_check(fx.script)
        findings = mod.scan(fx.fixture, str(fx.fixture.parent))

        actual_by_line: dict[int, list] = {}
        for f in findings:
            actual_by_line.setdefault(f.start_line, []).append(f)

        # 1. Every annotated line is flagged with the right rule + level.
        for exp in expected:
            actual = actual_by_line.get(exp.line, [])
            self.assertTrue(
                actual,
                f"{fx.fixture}:{exp.line}: annotation expects "
                f"{exp.rule_id} ({exp.level}) but scanner reported "
                f"nothing on this line."
            )
            ids = {a.rule_id for a in actual}
            levels = {a.level for a in actual}
            self.assertIn(
                exp.rule_id, ids,
                f"{fx.fixture}:{exp.line}: expected rule {exp.rule_id}, "
                f"got {sorted(ids)}"
            )
            self.assertIn(
                exp.level, levels,
                f"{fx.fixture}:{exp.line}: expected level {exp.level}, "
                f"got {sorted(levels)}"
            )

        # 2. No surprise findings on un-annotated lines.
        annotated_lines = {e.line for e in expected}
        unexpected = sorted(
            ln for ln in actual_by_line if ln not in annotated_lines
        )
        self.assertEqual(
            unexpected, [],
            f"{fx.fixture}: scanner flagged un-annotated lines "
            f"{unexpected}. Either add an inline annotation, fix the "
            f"scanner, or move the false positive into clean.<ext>."
        )

        # 3. Lines explicitly tagged NO-FINDING must stay silent.
        violations = sorted(ln for ln in silent_lines if ln in actual_by_line)
        self.assertEqual(
            violations, [],
            f"{fx.fixture}: lines tagged '← NO-FINDING' were flagged: "
            f"{violations}. The comment/string stripper likely regressed."
        )


if __name__ == "__main__":
    unittest.main()