#!/usr/bin/env python3
"""Post-process the merged SARIF file.

Applies, in order:
  1. Inline suppressions (codeguidelines:disable= comments)
  2. STYLE-099 SuppressionWithoutReason injection
  3. --exclude-rules filtering
  4. --baseline subtraction (or --refresh-baseline write-back)

Spec: spec/02-coding-guidelines/06-cicd-integration/98-faq.md
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "checks"))
from _lib.suppressions import parse_file_full, is_suppressed  # noqa: E402
from _lib.walker import walk_files, relpath  # noqa: E402

STYLE_099_EXTENSIONS = (".go", ".ts", ".tsx", ".js", ".jsx", ".php", ".py")
STYLE_099_RULE = {
    "id": "STYLE-099",
    "name": "SuppressionWithoutReason",
    "shortDescription": {"text": "codeguidelines:disable= comment is missing a reason after the em dash"},
    "helpUri": "https://github.com/alimtvnetwork/coding-guidelines-v23/blob/main/spec/02-coding-guidelines/06-cicd-integration/98-faq.md",
}


def main() -> int:
    args = _parse_args()
    doc = json.loads(Path(args.sarif).read_text(encoding="utf-8"))
    excluded = _split_csv(args.exclude_rules)

    suppressions_cache = _build_cache(Path(args.path))
    _apply_suppressions(doc, suppressions_cache)
    _inject_style_099(doc, suppressions_cache, Path(args.path))
    _apply_excludes(doc, excluded)

    if args.refresh_baseline:
        _write_baseline(doc, args.refresh_baseline)
        return 0

    if args.baseline:
        _apply_baseline(doc, args.baseline)

    Path(args.sarif).write_text(json.dumps(doc, indent=2), encoding="utf-8")
    return _exit_code_for(doc)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--sarif", required=True)
    p.add_argument("--path", required=True)
    p.add_argument("--baseline", default=None)
    p.add_argument("--refresh-baseline", default=None)
    p.add_argument("--exclude-rules", default="")
    return p.parse_args()


def _split_csv(value: str) -> set[str]:
    return {v.strip() for v in value.split(",") if v.strip()}


def _build_cache(root: Path) -> dict[str, object]:
    """Pre-scan every source file under root for suppressions."""
    cache: dict[str, object] = {}
    for file_path in walk_files(str(root), STYLE_099_EXTENSIONS):
        cache[str(file_path.resolve())] = parse_file_full(file_path)
    return cache


def _apply_suppressions(doc: dict, cache: dict) -> None:
    for run in doc.get("runs", []):
        kept = []
        for result in run.get("results", []):
            if _result_suppressed(result, cache):
                continue
            kept.append(result)
        run["results"] = kept


def _result_suppressed(result: dict, cache: dict) -> bool:
    rule_id, abs_uri, line = _abs_key_parts(result)
    parsed = cache.get(abs_uri)
    if parsed is None:
        return False
    return is_suppressed(parsed.valid, rule_id, line)


def _abs_key_parts(result: dict) -> tuple[str, str, int]:
    rule_id = result.get("ruleId", "")
    loc = result.get("locations", [{}])[0]
    phys = loc.get("physicalLocation", {})
    uri = phys.get("artifactLocation", {}).get("uri", "")
    line = phys.get("region", {}).get("startLine", 0)
    abs_uri = str(Path(uri).resolve()) if uri else ""
    return rule_id, abs_uri, line


def _inject_style_099(doc: dict, cache: dict, root: Path) -> None:
    """Emit a STYLE-099 finding for every reasonless disable comment."""
    findings = _build_style_099_findings(cache, root)
    if not findings:
        return
    run = _ensure_style_099_run(doc)
    run["results"].extend(findings)


def _build_style_099_findings(cache: dict, root: Path) -> list[dict]:
    out: list[dict] = []
    for abs_path, parsed in cache.items():
        for invalid in parsed.invalid:
            uri = relpath(Path(abs_path), str(root))
            out.append(_style_099_result(uri, invalid))
    return out


def _style_099_result(uri: str, invalid) -> dict:
    rules = ",".join(sorted(invalid.rule_ids)) or "<unknown>"
    msg = (
        f"Suppression for {rules} is missing a reason after the em dash (—) or '--'. "
        "Reasonless suppressions are ignored — the original finding still fires."
    )
    return {
        "ruleId": "STYLE-099",
        "level": "warning",
        "message": {"text": msg},
        "locations": [
            {
                "physicalLocation": {
                    "artifactLocation": {"uri": uri},
                    "region": {"startLine": invalid.comment_line, "startColumn": 1},
                }
            }
        ],
    }


def _ensure_style_099_run(doc: dict) -> dict:
    for run in doc.get("runs", []):
        driver = run.get("tool", {}).get("driver", {})
        if driver.get("name") == "coding-guidelines-style-099":
            return run
    new_run = {
        "tool": {
            "driver": {
                "name": "coding-guidelines-style-099",
                "version": _read_version(),
                "informationUri": "https://github.com/alimtvnetwork/coding-guidelines-v23",
                "rules": [STYLE_099_RULE],
            }
        },
        "results": [],
    }
    doc.setdefault("runs", []).append(new_run)
    return new_run


def _read_version() -> str:
    version_file = Path(__file__).resolve().parent.parent / "VERSION"
    try:
        return version_file.read_text(encoding="utf-8").strip()
    except OSError:
        return "0.0.0"


def _apply_excludes(doc: dict, excluded: set[str]) -> None:
    if not excluded:
        return
    for run in doc.get("runs", []):
        run["results"] = [r for r in run.get("results", []) if r.get("ruleId") not in excluded]


def _fingerprint(result: dict) -> str:
    rule_id, abs_uri, line = _abs_key_parts(result)
    msg = result.get("message", {}).get("text", "")
    digest = hashlib.sha256(msg.encode("utf-8")).hexdigest()[:16]
    uri = result.get("locations", [{}])[0].get("physicalLocation", {}).get("artifactLocation", {}).get("uri", "")
    return f"{rule_id}|{uri}|{line}|{digest}"


def _apply_baseline(doc: dict, baseline_path: str) -> None:
    baseline = _load_fingerprints(baseline_path)
    if baseline is None:
        return
    for run in doc.get("runs", []):
        run["results"] = [r for r in run.get("results", []) if _fingerprint(r) not in baseline]


def _load_fingerprints(path: str) -> set[str] | None:
    file = Path(path)
    if not file.exists():
        return set()
    try:
        baseline_doc = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    out: set[str] = set()
    for run in baseline_doc.get("runs", []):
        for result in run.get("results", []):
            out.add(_fingerprint(result))
    return out


def _write_baseline(doc: dict, path: str) -> None:
    Path(path).write_text(json.dumps(doc, indent=2), encoding="utf-8")


def _exit_code_for(doc: dict) -> int:
    for run in doc.get("runs", []):
        if run.get("results"):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
