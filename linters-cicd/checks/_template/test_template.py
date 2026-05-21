#!/usr/bin/env python3
"""Reference unit test for the TEMPLATE-001 example rule.

Copy this file alongside your new check (rename to
``test_<your_rule>.py``) when you copy ``_template/`` to a real
rule folder. The test runner discovers files matching
``test_*.py`` under ``linters-cicd/tests/`` — move it there once
you go live.

The rule ships in two languages (PHP via ``php.py``, TypeScript via
``typescript.py``). The tests exercise both implementations against
parallel ``dirty.<ext>`` / ``clean.<ext>`` fixtures so the contract
is identical across languages — same rule id, same level, same
message shape.
"""
from __future__ import annotations

import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_DIR = ROOT / "checks" / "_template"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


class TestTemplateRulePhp(unittest.TestCase):
    def test_dirty_fixture_produces_three_findings(self) -> None:
        mod = _load("template_php", TEMPLATE_DIR / "php.py")
        findings = mod.scan(TEMPLATE_DIR / "fixtures" / "dirty.php",
                            str(TEMPLATE_DIR / "fixtures"))
        # var_dump + print_r + error_log
        self.assertEqual(len(findings), 3)
        self.assertEqual({f.rule_id for f in findings}, {"TEMPLATE-001"})
        self.assertEqual({f.level for f in findings}, {"warning"})

    def test_clean_fixture_is_silent(self) -> None:
        mod = _load("template_php", TEMPLATE_DIR / "php.py")
        findings = mod.scan(TEMPLATE_DIR / "fixtures" / "clean.php",
                            str(TEMPLATE_DIR / "fixtures"))
        self.assertEqual(findings, [])

    def test_comment_only_call_is_not_flagged(self) -> None:
        mod = _load("template_php", TEMPLATE_DIR / "php.py")
        findings = mod.scan(TEMPLATE_DIR / "fixtures" / "dirty.php",
                            str(TEMPLATE_DIR / "fixtures"))
        # Line 12 is the `// var_dump(...)` comment — must NOT appear.
        self.assertNotIn(12, [f.start_line for f in findings])

    def test_php_file_runs_end_to_end_via_cli(self) -> None:
        out = TEMPLATE_DIR / "fixtures" / "_out.sarif"
        rc = subprocess.call([
            sys.executable, str(TEMPLATE_DIR / "php.py"),
            "--path", str(TEMPLATE_DIR / "fixtures"),
            "--format", "sarif",
            "--output", str(out),
        ])
        try:
            # Exit 1 = findings present (per SARIF contract).
            self.assertEqual(rc, 1)
            self.assertTrue(out.exists() and out.stat().st_size > 0)
        finally:
            if out.exists():
                out.unlink()


class TestTemplateRuleTypescript(unittest.TestCase):
    """Parallel suite for the TS sibling — same contract as PHP."""

    def test_dirty_fixture_produces_four_findings(self) -> None:
        mod = _load("template_ts", TEMPLATE_DIR / "typescript.py")
        findings = mod.scan(TEMPLATE_DIR / "fixtures" / "dirty.ts",
                            str(TEMPLATE_DIR / "fixtures"))
        # console.log + console.debug + debugger; + console.error
        self.assertEqual(len(findings), 4)
        self.assertEqual({f.rule_id for f in findings}, {"TEMPLATE-001"})
        self.assertEqual({f.level for f in findings}, {"warning"})
        # Findings come back ordered by line number.
        lines = [f.start_line for f in findings]
        self.assertEqual(lines, sorted(lines))

    def test_clean_fixture_is_silent(self) -> None:
        mod = _load("template_ts", TEMPLATE_DIR / "typescript.py")
        findings = mod.scan(TEMPLATE_DIR / "fixtures" / "clean.ts",
                            str(TEMPLATE_DIR / "fixtures"))
        self.assertEqual(findings, [])

    def test_negative_controls_are_not_flagged(self) -> None:
        """Comment-only call (line 15), in-string call (line 18), and
        the similarly-named function definition (lines 21-22) MUST NOT
        appear in the findings list."""
        mod = _load("template_ts", TEMPLATE_DIR / "typescript.py")
        findings = mod.scan(TEMPLATE_DIR / "fixtures" / "dirty.ts",
                            str(TEMPLATE_DIR / "fixtures"))
        flagged_lines = {f.start_line for f in findings}
        for negative in (15, 18, 21, 22):
            self.assertNotIn(negative, flagged_lines,
                             f"line {negative} is a negative control and "
                             f"must not be flagged")

    def test_typescript_file_runs_end_to_end_via_cli(self) -> None:
        out = TEMPLATE_DIR / "fixtures" / "_out.sarif"
        rc = subprocess.call([
            sys.executable, str(TEMPLATE_DIR / "typescript.py"),
            "--path", str(TEMPLATE_DIR / "fixtures"),
            "--format", "sarif",
            "--output", str(out),
        ])
        try:
            self.assertEqual(rc, 1)
            self.assertTrue(out.exists() and out.stat().st_size > 0)
        finally:
            if out.exists():
                out.unlink()


class TestTemplateCrossLanguageContract(unittest.TestCase):
    """Both implementations expose the same rule metadata so SARIF
    consumers treat them as one logical rule."""

    def test_rule_id_and_help_uri_match_across_languages(self) -> None:
        php = _load("template_php_meta", TEMPLATE_DIR / "php.py")
        ts = _load("template_ts_meta", TEMPLATE_DIR / "typescript.py")
        self.assertEqual(php.RULE.id, ts.RULE.id)
        self.assertEqual(php.RULE.name, ts.RULE.name)
        self.assertEqual(php.RULE.help_uri_relative, ts.RULE.help_uri_relative)


if __name__ == "__main__":
    unittest.main()
