#!/usr/bin/env node
// Verify shipped zips are newer than their source trees.
import { statSync, readdirSync } from "node:fs";
import { join } from "node:path";

function newestMtime(dir) {
  let max = 0;
  function walk(d) {
    let entries;
    try { entries = readdirSync(d); } catch { return; }
    for (const n of entries) {
      if (n === "node_modules" || n === ".git") continue;
      const p = join(d, n);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (s.mtimeMs > max) max = s.mtimeMs;
    }
  }
  walk(dir);
  return max;
}

const targets = [
  { zip: "public/inspect-page.zip", src: "extension-src" },
  { zip: "public/inspect-page-wp.zip", src: "wp-plugin" },
];

const errors = [];
for (const { zip, src } of targets) {
  let zStat;
  try { zStat = statSync(zip); } catch { errors.push(`${zip}: missing`); continue; }
  const srcMax = newestMtime(src);
  if (srcMax > zStat.mtimeMs) {
    const ageH = ((srcMax - zStat.mtimeMs) / 36e5).toFixed(2);
    errors.push(`${zip} stale by ${ageH}h vs ${src}`);
  }
}

if (errors.length) {
  console.error("[check-zip-freshness] Stale zips:");
  for (const e of errors) console.error("  " + e);
  console.error("  Fix: run `bash scripts/release.sh` (or package-wp.sh).");
  process.exit(1);
}
console.log("[check-zip-freshness] OK — zips fresh.");