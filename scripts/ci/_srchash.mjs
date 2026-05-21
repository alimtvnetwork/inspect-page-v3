#!/usr/bin/env node
// Deterministic source-tree hash. Used by package scripts (write) and
// check-zip-freshness (verify). Robust to mtime resets on CI.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";

const SKIP_DIRS = new Set(["node_modules", ".git", "tests", "__tests__"]);
const SKIP_FILE_RE = /(^|\/)(\.DS_Store|.*\.log)$/;

export function hashTree(root) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const n of entries) {
      if (SKIP_DIRS.has(n)) continue;
      const p = join(d, n);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (s.isFile()) {
        const rel = relative(root, p).split(sep).join("/");
        if (SKIP_FILE_RE.test("/" + rel)) continue;
        files.push([rel, p]);
      }
    }
  }
  walk(root);
  files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const h = createHash("sha256");
  for (const [rel, p] of files) {
    const fh = createHash("sha256").update(readFileSync(p)).digest("hex");
    h.update(rel);
    h.update("\0");
    h.update(fh);
    h.update("\n");
  }
  return h.digest("hex");
}

// CLI: node scripts/ci/_srchash.mjs <dir>  → prints hash
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) { console.error("usage: _srchash.mjs <dir>"); process.exit(2); }
  process.stdout.write(hashTree(dir) + "\n");
}