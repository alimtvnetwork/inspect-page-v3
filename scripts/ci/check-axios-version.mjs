#!/usr/bin/env node
// Supply-chain guard: if axios ever enters the dep tree, pin >= 1.7.4.
// See security-notes/axios-pin.md (Phase 5).
import { readFileSync } from "node:fs";

const MIN = [1, 7, 4];
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const spec = all.axios;

if (!spec) {
  console.log("[check-axios-version] OK — axios not in dependency tree.");
  process.exit(0);
}

const m = spec.match(/(\d+)\.(\d+)\.(\d+)/);
if (!m) {
  console.error(`[check-axios-version] Cannot parse axios spec: ${spec}`);
  process.exit(1);
}
const v = [Number(m[1]), Number(m[2]), Number(m[3])];
for (let i = 0; i < 3; i++) {
  if (v[i] > MIN[i]) { console.log(`[check-axios-version] OK — axios ${spec} >= 1.7.4`); process.exit(0); }
  if (v[i] < MIN[i]) { console.error(`[check-axios-version] axios ${spec} < 1.7.4 (CVE-2024-39338).`); process.exit(1); }
}
console.log(`[check-axios-version] OK — axios ${spec} == 1.7.4`);