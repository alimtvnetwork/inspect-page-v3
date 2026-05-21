#!/usr/bin/env python3
"""Smoke-mode rule selector for ``run-all.sh --smoke``.

Resolves the **smallest** set of rules a contributor needs to verify
after touching a single check folder. The selection is deterministic
and never includes more than the rules whose source files actually
changed (or, in ``--include-template`` mode, the starter kit itself).

Output (stdout) is the JSON payload consumed by ``run-all.sh``::

    {
      "rule_ids": ["TEMPLATE-001", "SQLI-RAW-001"],
      "fixture_dirs": [
        "linters-cicd/checks/_template/fixtures",
        "linters-cicd/checks/sqli-raw-execute/fixtures"
      ],
      "reasons": {
        "TEMPLATE-001": "template (--include-template)",
        "SQLI-RAW-001": "git: checks/sqli-raw-execute/php.py"
      },
      "skipped_slugs": ["_lib", "_template"]
    }

Exit codes:
    0  — at least one rule selected (payload emitted)
    3  — nothing changed and ``--include-template`` was not passed
         (caller should print a friendly hint and exit 0)
    2  — usage error / unreadable registry

Selection rules (in order):
    1. ``--include-template`` adds every rule whose registry entry
       points at a script under ``checks/_template/`` AND, as a
       safety net for the canonical starter kit, ``TEMPLATE-001``
       even if it is not registered (the kit is intentionally
       unregistered — see ``checks/_template/README.md``).
    2. ``git status`` + ``git diff --name-only`` against
       ``--base`` (default: ``HEAD``) — every modified path under
       ``linters-cicd/checks/<slug>/`` resolves to the rules whose
       registry entry references that slug.
    3. Folders starting with ``_`` (``_lib``, ``_template``) are
       reported under ``skipped_slugs`` and do NOT auto-select
       rules; they need ``--include-template`` to opt in. This
       prevents shared-helper edits from pretending to be a
       single-rule smoke test.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

CHECKS_DIR_NAME = "checks"
TEMPLATE_SLUG = "_template"
TEMPLATE_RULE_ID = "TEMPLATE-001"


def main() -> int:
    p = argparse.ArgumentParser(description="Smoke-mode rule selector")
    p.add_argument("--repo-root", required=True, help="Repository root (absolute path)")
    p.add_argument("--registry", required=True, help="Path to checks/registry.json")
    p.add_argument("--base", default="HEAD",
                   help="Git ref to diff against (default: HEAD = uncommitted + staged)")
    p.add_argument("--include-template", action="store_true",
                   help="Also run TEMPLATE-001 against the starter kit fixtures")
    args = p.parse_args()

    repo_root = Path(args.repo_root).resolve()
    registry_path = Path(args.registry).resolve()
    if not registry_path.is_file():
        print(f"::error::registry not found at {registry_path}", file=sys.stderr)
        return 2

    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"::error::cannot parse registry: {exc}", file=sys.stderr)
        return 2

    # slug -> [(rule_id, script_relpath), ...]
    slug_to_rules: dict[str, list[tuple[str, str]]] = {}
    for rule_id, meta in registry.items():
        for _lang, script in (meta.get("languages") or {}).items():
            slug = _slug_from_script(script)
            if slug is None:
                continue
            slug_to_rules.setdefault(slug, []).append((rule_id, script))

    selected: dict[str, str] = {}     # rule_id -> reason
    fixture_dirs: dict[str, None] = {}  # ordered set
    skipped_slugs: dict[str, None] = {}

    # --- 1. Template opt-in ----------------------------------------
    if args.include_template:
        for rule_id, scripts in slug_to_rules.get(TEMPLATE_SLUG, []):
            selected.setdefault(rule_id, "template (--include-template)")
        # Canonical starter kit is intentionally unregistered. Add
        # its placeholder rule + fixture dir so contributors can
        # smoke-test the example pipeline end-to-end.
        fdir = repo_root / "linters-cicd" / CHECKS_DIR_NAME / TEMPLATE_SLUG / "fixtures"
        if fdir.is_dir():
            fixture_dirs.setdefault(str(fdir.relative_to(repo_root)), None)
            selected.setdefault(TEMPLATE_RULE_ID, "template (--include-template)")

    # --- 2. Git-derived rules --------------------------------------
    changed_slugs, git_ok = _changed_slugs(repo_root, args.base)
    for slug in sorted(changed_slugs):
        if slug.startswith("_"):
            skipped_slugs.setdefault(slug, None)
            continue
        rules = slug_to_rules.get(slug, [])
        if not rules:
            # Folder changed but isn't registered yet — surface it as
            # a skipped slug so the user notices.
            skipped_slugs.setdefault(f"{slug} (unregistered)", None)
            continue
        for rule_id, script in rules:
            selected.setdefault(rule_id, f"git: {script}")
        fdir = repo_root / "linters-cicd" / CHECKS_DIR_NAME / slug / "fixtures"
        if fdir.is_dir():
            fixture_dirs.setdefault(str(fdir.relative_to(repo_root)), None)

    if not selected:
        if not git_ok:
            print("::warning::git diff unavailable — pass --include-template "
                  "or run inside a git checkout", file=sys.stderr)
        return 3

    payload = {
        "rule_ids": sorted(selected),
        "fixture_dirs": list(fixture_dirs),
        "reasons": selected,
        "skipped_slugs": list(skipped_slugs),
    }
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def _slug_from_script(script: str) -> str | None:
    """Return the slug from a script path like ``checks/<slug>/php.py``."""
    parts = script.replace("\\", "/").split("/")
    try:
        idx = parts.index(CHECKS_DIR_NAME)
    except ValueError:
        return None
    if idx + 1 >= len(parts):
        return None
    return parts[idx + 1]


def _changed_slugs(repo_root: Path, base: str) -> tuple[set[str], bool]:
    """Return (slugs touched under linters-cicd/checks/, git_available)."""
    paths: set[str] = set()
    git_ok = True
    for cmd in (
        ["git", "diff", "--name-only", base],
        ["git", "diff", "--name-only", "--cached"],
        ["git", "ls-files", "--others", "--exclude-standard"],
    ):
        try:
            res = subprocess.run(
                cmd, cwd=str(repo_root), capture_output=True, text=True, timeout=15,
            )
        except (OSError, subprocess.TimeoutExpired):
            git_ok = False
            continue
        if res.returncode != 0:
            # `git diff HEAD` fails on a fresh repo with no commits;
            # treat as "nothing to compare" rather than aborting.
            git_ok = git_ok and False
            continue
        for line in res.stdout.splitlines():
            line = line.strip()
            if line:
                paths.add(line)

    slugs: set[str] = set()
    prefix = f"linters-cicd/{CHECKS_DIR_NAME}/"
    for raw in paths:
        norm = raw.replace("\\", "/")
        if not norm.startswith(prefix):
            continue
        rest = norm[len(prefix):]
        slug = rest.split("/", 1)[0]
        if slug:
            slugs.add(slug)
    return slugs, git_ok


if __name__ == "__main__":
    sys.exit(main())