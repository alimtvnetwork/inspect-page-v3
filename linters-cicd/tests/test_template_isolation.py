"""Guard — `_template/` MUST NOT be wired into the production rule pack.

The starter kit at `checks/_template/` ships a fully-working example
rule (`TEMPLATE-001`) so a blind AI can copy → rename → register a new
linter in one iteration. It is intentionally **not** a real rule:

  * it has no spec section behind its `help_uri_relative`,
  * its fixtures are deliberately noisy (they exist to be flagged),
  * its rule ID (`TEMPLATE-001`) is a placeholder, not a CI contract.

If `_template/` ever leaks into `registry.json` or gets dispatched by
the orchestrator (`run-all.sh`), every downstream consumer suddenly
sees TEMPLATE-001 findings on their own clean fixtures. This test
locks that door shut.

Failure modes caught:
  1. registry.json gains a `TEMPLATE-*` entry, or any entry whose
     `languages.*` script path points inside `checks/_template/`.
  2. run-all.sh dispatches anything from `checks/_template/` when run
     against the template's own fixtures (which would mean the
     orchestrator stopped skipping the folder).
"""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY = REPO_ROOT / "linters-cicd" / "checks" / "registry.json"
RUN_ALL = REPO_ROOT / "linters-cicd" / "run-all.sh"
TEMPLATE_DIR = REPO_ROOT / "linters-cicd" / "checks" / "_template"
TEMPLATE_FIXTURES = TEMPLATE_DIR / "fixtures"


class TestTemplateIsolation(unittest.TestCase):
    def test_registry_has_no_template_rule_id(self) -> None:
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        leaked = [rid for rid in registry if rid.upper().startswith("TEMPLATE-")]
        self.assertEqual(
            leaked,
            [],
            f"Placeholder rule IDs found in registry.json: {leaked}. "
            "The `_template/` starter kit must never be registered — "
            "copy it to a real slug first (see checks/_template/README.md).",
        )

    def test_no_registry_entry_points_into_template_folder(self) -> None:
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        offenders: list[str] = []
        for rule_id, meta in registry.items():
            for lang, script in (meta.get("languages") or {}).items():
                normalized = script.replace("\\", "/")
                if "checks/_template/" in normalized or normalized.startswith("checks/_template"):
                    offenders.append(f"{rule_id}.{lang} -> {script}")
        self.assertEqual(
            offenders,
            [],
            "Registry entries point into checks/_template/: "
            f"{offenders}. Copy the template to a real slug before registering.",
        )

    def test_template_folder_layout_is_intact(self) -> None:
        # Sanity guard: if someone deletes the starter kit, the next two
        # checks become vacuously true. Fail loudly instead.
        self.assertTrue(TEMPLATE_DIR.is_dir(), f"missing {TEMPLATE_DIR}")
        self.assertTrue(
            (TEMPLATE_DIR / "README.md").is_file(),
            "checks/_template/README.md is the AI onboarding doc; do not delete it.",
        )
        self.assertTrue(TEMPLATE_FIXTURES.is_dir(), f"missing {TEMPLATE_FIXTURES}")

    def test_runall_does_not_dispatch_template_against_its_fixtures(self) -> None:
        if not RUN_ALL.exists() or not TEMPLATE_FIXTURES.is_dir():
            self.skipTest("orchestrator or template fixtures not present")
        result = subprocess.run(
            [
                "bash",
                str(RUN_ALL),
                "--path",
                str(TEMPLATE_FIXTURES),
                "--format",
                "text",
                "--output",
                "/tmp/_test_template_isolation.txt",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        combined = (result.stdout or "") + "\n" + (result.stderr or "")
        try:
            produced = Path("/tmp/_test_template_isolation.txt").read_text(encoding="utf-8")
        except FileNotFoundError:
            produced = ""
        haystack = combined + "\n" + produced
        self.assertNotIn(
            "TEMPLATE-001",
            haystack,
            "Orchestrator dispatched TEMPLATE-001 — checks/_template/ is "
            "leaking into the production rule pack. Either it was added "
            "to registry.json, or run-all.sh stopped skipping the folder.",
        )
        # The `--path` argument echoes back into the orchestrator banner,
        # so we cannot reject the literal substring `checks/_template/`.
        # Instead, look for evidence of a *dispatch* into the template:
        # a job-name suffix or a dispatch arrow that references the
        # template's own scripts.
        normalized = haystack.replace("\\", "/")
        forbidden_markers = (
            "coding-guidelines-_template",   # job-name shape used by run-all.sh
            "checks/_template/php.py",
            "checks/_template/typescript.py",
            "checks/_template/go.py",
            "checks/_template/universal.py",
        )
        for marker in forbidden_markers:
            self.assertNotIn(
                marker,
                normalized,
                f"Orchestrator referenced `{marker}` — the starter kit "
                "must remain dormant. Either registry.json wired it up "
                "or run-all.sh stopped skipping checks/_template/.",
            )


if __name__ == "__main__":
    unittest.main()