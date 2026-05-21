"""Unit tests for walker.py exclude_globs logic (B9 / v3.20.0)."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from checks._lib.walker import walk_files, walk_files_middle_out  # noqa: E402


def _touch(root: Path, rel: str) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("// stub\n", encoding="utf-8")


class TestExcludeGlobs(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        _touch(self.root, "src/app.go")
        _touch(self.root, "src/util.go")
        _touch(self.root, "thirdparty/lib1/big.go")
        _touch(self.root, "thirdparty/lib2/small.go")
        _touch(self.root, "internal/gen/types.gen.go")
        _touch(self.root, "internal/handler.go")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _names(self, files: list[Path]) -> set[str]:
        return {f.relative_to(self.root).as_posix() for f in files}

    def test_no_globs_returns_all(self) -> None:
        files = walk_files(str(self.root), [".go"])
        self.assertEqual(len(files), 6)

    def test_excludes_directory_subtree(self) -> None:
        files = walk_files(str(self.root), [".go"], exclude_globs=["thirdparty/**"])
        names = self._names(files)
        self.assertNotIn("thirdparty/lib1/big.go", names)
        self.assertNotIn("thirdparty/lib2/small.go", names)
        self.assertIn("src/app.go", names)

    def test_excludes_by_filename_glob(self) -> None:
        files = walk_files(str(self.root), [".go"], exclude_globs=["**/*.gen.go"])
        names = self._names(files)
        self.assertNotIn("internal/gen/types.gen.go", names)
        self.assertIn("internal/handler.go", names)

    def test_multiple_globs_combine(self) -> None:
        files = walk_files(
            str(self.root),
            [".go"],
            exclude_globs=["thirdparty/**", "**/*.gen.go"],
        )
        names = self._names(files)
        self.assertEqual(
            names,
            {"src/app.go", "src/util.go", "internal/handler.go"},
        )

    def test_empty_glob_list_is_noop(self) -> None:
        files = walk_files(str(self.root), [".go"], exclude_globs=[])
        self.assertEqual(len(files), 6)

    def test_extension_filter_still_applies(self) -> None:
        _touch(self.root, "src/readme.md")
        files = walk_files(str(self.root), [".go"], exclude_globs=["thirdparty/**"])
        names = self._names(files)
        self.assertNotIn("src/readme.md", names)

    def test_middle_out_respects_exclude_globs(self) -> None:
        files = walk_files_middle_out(
            str(self.root),
            [".go"],
            exclude_globs=["thirdparty/**"],
        )
        names = self._names(files)
        self.assertNotIn("thirdparty/lib1/big.go", names)
        self.assertEqual(len(files), 4)


class TestParseExcludePaths(unittest.TestCase):
    def test_csv_split(self) -> None:
        from checks._lib.cli import parse_exclude_paths

        self.assertEqual(parse_exclude_paths(""), [])
        self.assertEqual(
            parse_exclude_paths("vendor/**, **/*.gen.go"),
            ["vendor/**", "**/*.gen.go"],
        )
        self.assertEqual(parse_exclude_paths("a,,b,"), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
