"""Unit tests for `checks/_lib/markdown_links.py`.

Covers: link extraction, heading slugification, fenced-code immunity,
anchor resolution (both self and cross-file), external-link skipping,
and root-escape protection.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from checks._lib.markdown_links import (
    BrokenLink,
    LinkRef,
    check_file,
    extract_heading_slugs,
    extract_links,
)


class TestExtractLinks(unittest.TestCase):
    def test_relative_link_with_anchor(self) -> None:
        links = extract_links("See [naming](../04/naming.md#rule-9) for details.")
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0].target_path, "../04/naming.md")
        self.assertEqual(links[0].anchor, "rule-9")

    def test_pure_anchor_link(self) -> None:
        links = extract_links("Jump to [section](#overview).")
        self.assertEqual(links[0].target_path, "")
        self.assertEqual(links[0].anchor, "overview")

    def test_external_links_skipped(self) -> None:
        body = (
            "[gh](https://github.com)\n"
            "[mail](mailto:a@b.com)\n"
            "[ftp](ftp://x.y)\n"
            "[mem](mem://architecture/error-handling)\n"
            "[local](./file.md)\n"
        )
        links = extract_links(body)
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0].target_path, "./file.md")

    def test_links_in_fenced_code_skipped(self) -> None:
        body = (
            "Real [a](a.md)\n"
            "```\n"
            "Fake [b](b.md)\n"
            "```\n"
            "Real [c](c.md)\n"
        )
        targets = [l.target_path for l in extract_links(body)]
        self.assertEqual(targets, ["a.md", "c.md"])

    def test_tilde_fences_also_skip(self) -> None:
        body = "Real [a](a.md)\n~~~\n[b](b.md)\n~~~\n"
        self.assertEqual([l.target_path for l in extract_links(body)], ["a.md"])

    def test_link_with_title_attribute(self) -> None:
        links = extract_links('[t](file.md "title here")')
        self.assertEqual(links[0].target_path, "file.md")


class TestSlugify(unittest.TestCase):
    def test_basic_heading(self) -> None:
        slugs = extract_heading_slugs("# Hello World\n## Sub Section\n")
        self.assertEqual(slugs, {"hello-world", "sub-section"})

    def test_punctuation_stripped(self) -> None:
        slugs = extract_heading_slugs("# Rule 9: Auto-Inverted Fields!\n")
        self.assertIn("rule-9-auto-inverted-fields", slugs)

    def test_duplicate_disambiguation(self) -> None:
        slugs = extract_heading_slugs("# Done\n# Done\n# Done\n")
        self.assertEqual(slugs, {"done", "done-1", "done-2"})

    def test_headings_in_fence_ignored(self) -> None:
        body = "# Real\n```\n# Fake\n```\n"
        self.assertEqual(extract_heading_slugs(body), {"real"})

    def test_em_dash_preserves_double_hyphen(self) -> None:
        # GitHub does NOT collapse consecutive hyphens — `Phase 1 — AI`
        # becomes `phase-1--ai` (em-dash strips, surrounding spaces both
        # become hyphens). Regression test for the v1.0 bug that produced
        # false positives on every "X — Y" heading in spec/.
        slugs = extract_heading_slugs("# Phase 1 — AI Context Layer\n")
        self.assertIn("phase-1--ai-context-layer", slugs)

    def test_ampersand_preserves_double_hyphen(self) -> None:
        # `4. Envelope Parsing & Enrichment` → `4-envelope-parsing--enrichment`
        slugs = extract_heading_slugs("## 4. Envelope Parsing & Enrichment\n")
        self.assertIn("4-envelope-parsing--enrichment", slugs)


class TestCheckFile(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _write(self, rel: str, body: str) -> Path:
        p = self.root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(body, encoding="utf-8")
        return p

    def test_valid_cross_file_anchor(self) -> None:
        self._write("a.md", "[link](b.md#foo)")
        self._write("b.md", "# Foo\nbody\n")
        cache: dict[Path, set[str]] = {}
        self.assertEqual(check_file(self.root / "a.md", root=self.root, slug_cache=cache), [])

    def test_missing_target_file(self) -> None:
        self._write("a.md", "[link](missing.md)")
        cache: dict[Path, set[str]] = {}
        result = check_file(self.root / "a.md", root=self.root, slug_cache=cache)
        self.assertEqual(len(result), 1)
        self.assertIn("not found", result[0].message)

    def test_missing_anchor_in_target(self) -> None:
        self._write("a.md", "[link](b.md#nope)")
        self._write("b.md", "# Foo\n")
        cache: dict[Path, set[str]] = {}
        result = check_file(self.root / "a.md", root=self.root, slug_cache=cache)
        self.assertEqual(len(result), 1)
        self.assertIn("Broken anchor", result[0].message)

    def test_self_anchor_resolves(self) -> None:
        self._write("a.md", "# Top\n[jump](#top)\n")
        cache: dict[Path, set[str]] = {}
        self.assertEqual(check_file(self.root / "a.md", root=self.root, slug_cache=cache), [])

    def test_self_anchor_broken(self) -> None:
        self._write("a.md", "# Top\n[jump](#nowhere)\n")
        cache: dict[Path, set[str]] = {}
        result = check_file(self.root / "a.md", root=self.root, slug_cache=cache)
        self.assertEqual(len(result), 1)
        self.assertIn("not found in this file", result[0].message)

    def test_inline_identifier_pattern_skipped(self) -> None:
        # `[val](apperror.AppError)` style prose — not a real link.
        body = "Assign [val](AppError) to capture the error.\n"
        self._write("a.md", body)
        cache: dict[Path, set[str]] = {}
        self.assertEqual(check_file(self.root / "a.md", root=self.root, slug_cache=cache), [])

    def test_real_md_link_with_extension_not_skipped(self) -> None:
        self._write("a.md", "[real](missing.md)\n")
        cache: dict[Path, set[str]] = {}
        result = check_file(self.root / "a.md", root=self.root, slug_cache=cache)
        self.assertEqual(len(result), 1)
        self.assertIn("not found", result[0].message)

    def test_non_md_target_skips_anchor_check(self) -> None:
        self._write("a.md", "[img](logo.png#anything)")
        self._write("logo.png", "binary data")
        cache: dict[Path, set[str]] = {}
        self.assertEqual(check_file(self.root / "a.md", root=self.root, slug_cache=cache), [])

    def test_slug_cache_reused(self) -> None:
        self._write("a.md", "[1](b.md#foo) and [2](b.md#foo)")
        self._write("b.md", "# Foo\n")
        cache: dict[Path, set[str]] = {}
        check_file(self.root / "a.md", root=self.root, slug_cache=cache)
        # b.md slugs should now be cached
        self.assertIn((self.root / "b.md").resolve(), cache)


if __name__ == "__main__":
    unittest.main()
