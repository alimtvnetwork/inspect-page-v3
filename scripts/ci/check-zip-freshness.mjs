#!/usr/bin/env node
// Verify shipped zips match their source trees via content hash.
// (mtime is unreliable on CI because git checkout doesn't preserve it.)
import { existsSync, readFileSync, statSync } from "node:fs";
import { hashTree } from "./_srchash.mjs";

const targets = [
  { zip: "public/inspect-page.zip", src: "extension-src" },
  { zip: "public/inspect-page-wp.zip", src: "wp-plugin/inspect-page" },
];

const errors = [];
for (const { zip, src } of targets) {
  if (!existsSync(zip)) { errors.push(`${zip}: missing`); continue; }
  const hashFile = zip + ".srchash";
  if (!existsSync(hashFile)) {
    errors.push(`${zip}: missing ${hashFile} (repackage to generate)`);
    continue;
  }
  const stored = readFileSync(hashFile, "utf8").trim().split(/\s+/)[0];
  const current = hashTree(src);
  if (stored !== current) {
    errors.push(`${zip} stale vs ${src} (hash mismatch)`);
  }
}

if (errors.length) {
  console.error("[check-zip-freshness] Stale zips:");
  for (const e of errors) console.error("  " + e);
  console.error("  Fix: run `bash scripts/release.sh` (or package-wp.sh / extension/scripts/package.sh).");
  process.exit(1);
}
console.log("[check-zip-freshness] OK — zips match source hash.");