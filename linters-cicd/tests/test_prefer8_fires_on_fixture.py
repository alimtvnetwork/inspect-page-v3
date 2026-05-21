"""End-to-end check that CODE-RED-005 (FunctionLengthPrefer8) actually
fires against the committed fixture under the **strict-8** contract.

Two assertions, mirroring the two enforcement surfaces:

  1. The linters-cicd ``function-length-prefer8/typescript.py`` scanner
     emits a SARIF ``error`` for the 11-line fixture and exits non-zero.
     This is the binding build-failing rule.
  2. The sibling ``function-length/typescript.py`` (CODE-RED-004 hard
     cap, 15) stays silent on the same fixture, proving the redundant
     safety net only kicks in for >15-line bodies and the two rules
     don't double-report.

If a future refactor either drops CODE-RED-005 or moves the fixture out
of the 9–15 band (where only CODE-RED-005 fires), this test fails
loudly — exactly the regression guard we want.
"""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = REPO_ROOT / "linters-cicd" / "tests" / "fixtures" / "code-red-005"
BOUNDARY_DIR = REPO_ROOT / "linters-cicd" / "tests" / "fixtures" / "code-red-005-boundary-15"
SCANNER_DIR = REPO_ROOT / "linters-cicd" / "checks"
PREFER8 = SCANNER_DIR / "function-length-prefer8" / "typescript.py"
HARDCAP = SCANNER_DIR / "function-length" / "typescript.py"


def run_scanner(scanner: Path, path: Path | None = None) -> tuple[int, dict]:
    cmd = [sys.executable, str(scanner),
           "--path", str(path or FIXTURE_DIR),
           "--format", "sarif"]
    result = subprocess.run(cmd, capture_output=True, text=True,
                            check=False, timeout=30)
    payload = json.loads(result.stdout) if result.stdout.strip() else {}
    return result.returncode, payload


def collect_findings(payload: dict) -> list[dict]:
    runs = payload.get("runs", [])
    if not runs:
        return []
    return runs[0].get("results", [])


class Prefer8FiresOnFixtureTests(unittest.TestCase):

    def test_fixture_file_exists(self) -> None:
        self.assertTrue((FIXTURE_DIR / "too-long.ts").is_file(),
                        "CODE-RED-005 fixture missing — test cannot run.")

    def test_prefer8_scanner_flags_fixture(self) -> None:
        code, payload = run_scanner(PREFER8)
        findings = collect_findings(payload)
        self.assertEqual(len(findings), 1,
                         msg=f"expected 1 strict-8 finding, got {findings}")
        rule_id = findings[0].get("ruleId")
        self.assertEqual(rule_id, "CODE-RED-005")
        level = findings[0].get("level")
        self.assertEqual(level, "error",
                         msg="CODE-RED-005 must emit `error`-level findings under strict-8")
        self.assertNotEqual(code, 0,
                            "scanner must exit non-zero when findings exist")

    def test_hardcap_scanner_silent_on_same_fixture(self) -> None:
        code, payload = run_scanner(HARDCAP)
        findings = collect_findings(payload)
        self.assertEqual(findings, [],
                         msg="CODE-RED-004 (>15-line safety net) must stay silent on a 9–15 line body")
        self.assertEqual(code, 0)

    def test_boundary_15_fixture_exists(self) -> None:
        self.assertTrue((BOUNDARY_DIR / "at-cap.ts").is_file(),
                        "CODE-RED-005 boundary-15 fixture missing — test cannot run.")

    def test_boundary_15_prefer8_errors(self) -> None:
        """A body with EXACTLY 15 effective lines is the upper edge of the
        prefer-band. Per policy (see _shared.py), CODE-RED-005 must error
        at strict cap 8 and report '15 effective lines'."""
        code, payload = run_scanner(PREFER8, BOUNDARY_DIR)
        findings = collect_findings(payload)
        self.assertEqual(len(findings), 1,
                         msg=f"expected 1 strict-8 finding at boundary 15, got {findings}")
        self.assertEqual(findings[0].get("ruleId"), "CODE-RED-005")
        self.assertEqual(findings[0].get("level"), "error")
        msg_text = findings[0].get("message", {}).get("text", "")
        self.assertIn("15 effective lines", msg_text,
                      msg=f"message must report 15 effective lines, got: {msg_text!r}")
        self.assertNotEqual(code, 0)

    def test_boundary_15_hardcap_silent(self) -> None:
        """CODE-RED-004's hard cap is 15 *exclusive* (>15 fires). At the
        boundary value 15 the redundant safety net must stay silent — only
        CODE-RED-005 reports, preventing double-counting."""
        code, payload = run_scanner(HARDCAP, BOUNDARY_DIR)
        findings = collect_findings(payload)
        self.assertEqual(findings, [],
                         msg=f"CODE-RED-004 must be silent at exactly 15 effective lines, got {findings}")
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
