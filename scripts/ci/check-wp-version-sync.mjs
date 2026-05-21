#!/usr/bin/env node
// Verify WP plugin version is consistent between header, constant, and docs.
import { readFileSync } from "node:fs";

const php = readFileSync("wp-plugin/inspect-page/inspect-page.php", "utf8");
const headerM = php.match(/\*\s*Version:\s*([0-9.]+)/);
const constM = php.match(/INSPECT_PAGE_VERSION['"],\s*['"]([0-9.]+)['"]/);

const errors = [];
if (!headerM) errors.push("plugin header Version not found");
const headerV = headerM?.[1];
if (constM && constM[1] !== headerV) {
  errors.push(`INSPECT_PAGE_VERSION (${constM[1]}) != header (${headerV})`);
}

try {
  const docs = readFileSync("docs/PROJECT-DOCS.md", "utf8");
  const docM = docs.match(/WP plugin v([0-9.]+)/);
  if (docM && docM[1] !== headerV) {
    errors.push(`PROJECT-DOCS WP plugin v${docM[1]} != header v${headerV}`);
  }
} catch {}

if (errors.length) {
  console.error("[check-wp-version-sync] WP version drift:");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`[check-wp-version-sync] OK — WP plugin v${headerV}.`);