#!/usr/bin/env node
// Verify extension version is consistent across manifest, WhatsNew, and release notes.
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("extension-src/manifest.json", "utf8"));
const manifestV = manifest.version;

const errors = [];
function check(label, file, regex) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { errors.push(`${label}: missing ${file}`); return; }
  const m = text.match(regex);
  if (!m) { errors.push(`${label}: no version match in ${file}`); return; }
  if (m[1] !== manifestV) errors.push(`${label}: ${file} has ${m[1]}, manifest has ${manifestV}`);
}

check("WhatsNew", "src/components/landing/WhatsNew.tsx", /v(\d+\.\d+\.\d+)/);
check("PROJECT-DOCS", "docs/PROJECT-DOCS.md", /Extension\s+`?v(\d+\.\d+\.\d+)`?/);

if (errors.length) {
  console.error("[check-version-sync] Version drift:");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`[check-version-sync] OK — extension v${manifestV} consistent.`);