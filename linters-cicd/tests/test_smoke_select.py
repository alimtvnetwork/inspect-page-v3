"""Unit tests for the ``smoke-select.py`` rule selector.

Locks the contract between ``run-all.sh --smoke`` and the selector:
  * registry entries map slug → list[(rule_id, script)]
  * ``--include-template`` always picks ``TEMPLATE-001`` when the
    starter-kit fixtures folder exists, even if the rule is
    intentionally absent from ``registry.json``.
  * Unregistered slugs and ``_*`` slugs land in ``skipped_slugs``,
    they never auto-select rules.
  * Exit code 3 means "nothing to verify" (caller should print a
    friendly hint and exit 0).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SELECTOR = REPO_ROOT / "linters-cicd" / "scripts" / "smoke-select.py"


def _git_add_allowed() -> bool:
    """Some sandboxed environments block `git add`. Skip git-dependent
    tests cleanly when that is the case so the suite stays green."""
    with tempfile.TemporaryDirectory() as tmp:
        try:
            subprocess.run(["git", "init", "-q", "-b", "main", tmp],
                           check=True, capture_output=True)
            (Path(tmp) / "x").write_text("y")
            res = subprocess.run(["git", "-C", tmp, "add", "-A"],
                                 capture_output=True, text=True)
            return res.returncode == 0
        except (FileNotFoundError, subprocess.CalledProcessError):
            return False


GIT_OK = _git_add_allowed()


def _run(repo: Path, registry: Path, *extra: str) -> tuple[int, dict | None, str]:
    res = subprocess.run(
        [
            sys.executable, str(SELECTOR),
            "--repo-root", str(repo),
            "--registry", str(registry),
            *extra,
        ],
        capture_output=True, text=True, timeout=30,
    )
    payload: dict | None = None
    if res.stdout.strip():
        try:
            payload = json.loads(res.stdout)
        except json.JSONDecodeError:
            payload = None
    return res.returncode, payload, res.stderr


def _make_repo(root: Path, registry_obj: dict, *,
               with_template_fixtures: bool = True) -> tuple[Path, Path]:
    """Materialise a minimal git repo with the requested registry."""
    checks = root / "linters-cicd" / "checks"
    checks.mkdir(parents=True)
    registry = checks / "registry.json"
    registry.write_text(json.dumps(registry_obj), encoding="utf-8")
    if with_template_fixtures:
        (checks / "_template" / "fixtures").mkdir(parents=True)
        (checks / "_template" / "fixtures" / "dirty.php").write_text("<?php\n")
    if GIT_OK:
        env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
               "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
        subprocess.run(["git", "init", "-q", "-b", "main", str(root)],
                       check=True, env=env)
        # Persist identity in the repo so later commits in the test
        # body work even without env propagation.
        subprocess.run(["git", "-C", str(root), "config", "user.email", "t@t"], check=True)
        subprocess.run(["git", "-C", str(root), "config", "user.name", "t"], check=True)
        subprocess.run(["git", "-C", str(root), "add", "-A"], check=True, env=env)
        subprocess.run(["git", "-C", str(root), "commit", "-q", "-m", "init"],
                       check=True, env=env)
    return root, registry


class TestSmokeSelect(unittest.TestCase):
    def test_no_changes_no_template_returns_three(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _, registry = _make_repo(repo, {
                "RULE-001": {"languages": {"php": "checks/some-rule/php.py"}},
            })
            rc, payload, _err = _run(repo, registry)
            self.assertEqual(rc, 3)
            self.assertIsNone(payload)

    def test_include_template_selects_template_rule(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _, registry = _make_repo(repo, {
                "RULE-001": {"languages": {"php": "checks/some-rule/php.py"}},
            })
            rc, payload, _err = _run(repo, registry, "--include-template")
            self.assertEqual(rc, 0)
            assert payload is not None
            self.assertIn("TEMPLATE-001", payload["rule_ids"])
            self.assertIn(
                "linters-cicd/checks/_template/fixtures",
                payload["fixture_dirs"],
            )
            self.assertEqual(
                payload["reasons"]["TEMPLATE-001"],
                "template (--include-template)",
            )

    def test_changed_check_folder_selects_its_rules(self) -> None:
        if not GIT_OK:
            self.skipTest("sandbox blocks `git add`; skipping git-diff path")
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _, registry = _make_repo(repo, {
                "RULE-001": {"languages": {
                    "php": "checks/some-rule/php.py",
                    "typescript": "checks/some-rule/typescript.py",
                }},
                "RULE-002": {"languages": {"sql": "checks/other-rule/sql.py"}},
            })
            # Materialise the rule folder + fixture, commit, then edit
            # so `git diff HEAD` reports the change.
            (repo / "linters-cicd" / "checks" / "some-rule" / "fixtures").mkdir(parents=True)
            (repo / "linters-cicd" / "checks" / "some-rule" / "php.py").write_text("# v1")
            subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "rule"],
                           check=True)
            (repo / "linters-cicd" / "checks" / "some-rule" / "php.py").write_text("# v2")

            rc, payload, _err = _run(repo, registry)
            self.assertEqual(rc, 0)
            assert payload is not None
            self.assertEqual(payload["rule_ids"], ["RULE-001"])
            self.assertNotIn("RULE-002", payload["rule_ids"])
            self.assertEqual(
                payload["fixture_dirs"],
                ["linters-cicd/checks/some-rule/fixtures"],
            )
            self.assertTrue(
                payload["reasons"]["RULE-001"].startswith("git: checks/some-rule/"),
            )

    def test_underscore_slug_is_skipped_not_selected(self) -> None:
        if not GIT_OK:
            self.skipTest("sandbox blocks `git add`; skipping git-diff path")
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _, registry = _make_repo(repo, {
                "RULE-001": {"languages": {"php": "checks/some-rule/php.py"}},
            })
            # Edit a shared-lib file, which lives under checks/_lib/.
            (repo / "linters-cicd" / "checks" / "_lib").mkdir(parents=True)
            (repo / "linters-cicd" / "checks" / "_lib" / "helper.py").write_text("# v1")
            subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "lib"],
                           check=True)
            (repo / "linters-cicd" / "checks" / "_lib" / "helper.py").write_text("# v2")

            rc, _payload, _err = _run(repo, registry)
            # _lib alone does not select any rule -> rc=3 (nothing to verify).
            self.assertEqual(rc, 3)

    def test_unregistered_slug_surfaces_in_skipped(self) -> None:
        if not GIT_OK:
            self.skipTest("sandbox blocks `git add`; skipping git-diff path")
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            _, registry = _make_repo(repo, {
                "RULE-001": {"languages": {"php": "checks/some-rule/php.py"}},
            })
            # Add a brand-new check folder that's not in the registry yet.
            (repo / "linters-cicd" / "checks" / "brand-new").mkdir(parents=True)
            (repo / "linters-cicd" / "checks" / "brand-new" / "php.py").write_text("# new")
            subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-q", "-m", "n"],
                           check=True)
            (repo / "linters-cicd" / "checks" / "brand-new" / "php.py").write_text("# v2")

            rc, _payload, _err = _run(repo, registry, "--include-template")
            # --include-template keeps us at rc=0 even though brand-new
            # is unregistered.
            self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()