#!/usr/bin/env python3
"""Merge all SARIF files in a directory into a single SARIF 2.1.0 document."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def merge(in_dir: str, out_path: str, fmt: str) -> None:
    runs: list[dict] = []
    for sarif_file in sorted(Path(in_dir).glob("*.sarif")):
        with sarif_file.open() as fh:
            doc = json.load(fh)
            runs.extend(doc.get("runs", []))

    if fmt == "sarif":
        merged = {
            "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
            "version": "2.1.0",
            "runs": runs,
        }
        Path(out_path).write_text(json.dumps(merged, indent=2), encoding="utf-8")
        return

    # text fallback
    lines = []
    total = 0
    for run in runs:
        tool = run["tool"]["driver"]["name"]
        results = run.get("results", [])
        total += len(results)
        if not results:
            lines.append(f"✅ {tool}: clean")
            continue
        lines.append(f"❌ {tool}: {len(results)} finding(s)")
        for r in results:
            loc = r["locations"][0]["physicalLocation"]
            uri = loc["artifactLocation"]["uri"]
            line = loc["region"]["startLine"]
            lines.append(f"   [{r['level']}] {uri}:{line}  {r['ruleId']}  {r['message']['text']}")
    lines.append("")
    lines.append(f"Total: {total} finding(s) across {len(runs)} tool(s)")
    Path(out_path).write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    in_dir, out_path, fmt = sys.argv[1], sys.argv[2], sys.argv[3]
    merge(in_dir, out_path, fmt)
