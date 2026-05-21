"""Integration test — confirms SPEC-LINK-001 is wired into run-all.sh.

Locks in the v3.18.0 contract: the orchestrator dispatches SPEC-LINK-001
through its registry-driven loop, and a clean spec/ tree exits 0 for
that rule.

If this test fails, either:
  1. registry.json no longer lists SPEC-LINK-001/markdown, or
  2. checks/spec-links/markdown.py is missing/broken, or
  3. run-all.sh's dispatch loop regressed (rule filter, language gate).
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RUN_ALL = REPO_ROOT / "linters-cicd" / "run-all.sh"
SPEC_DIR = REPO_ROOT / "spec"


class TestRunAllSpecLinkWiring(unittest.TestCase):
    def test_registry_lists_spec_link_markdown(self) -> None:
        registry_path = REPO_ROOT / "linters-cicd" / "checks" / "registry.json"
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        self.assertIn("SPEC-LINK-001", registry)
        entry = registry["SPEC-LINK-001"]
        self.assertEqual(entry["level"], "error")
        self.assertIn("markdown", entry["languages"])

    def test_runall_dispatches_spec_link_and_exits_clean(self) -> None:
        if not SPEC_DIR.exists():
            self.skipTest("spec/ tree not present in this checkout")
        result = subprocess.run(
            [
                "bash",
                str(RUN_ALL),
                "--path",
                str(SPEC_DIR),
                "--rules",
                "SPEC-LINK-001",
                "--check-timeout",
                "60",
                "--output",
                "/tmp/_test_spec_link.sarif",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        combined = result.stdout + result.stderr
        self.assertIn("SPEC-LINK-001", combined, msg=combined)
        self.assertIn("markdown", combined, msg=combined)
        self.assertIn("✅ clean", combined, msg=combined)
        self.assertEqual(result.returncode, 0, msg=combined)


if __name__ == "__main__":
    unittest.main()
