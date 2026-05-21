#!/usr/bin/env node
// Brand guard: fail CI if banned tokens appear in shipped sources.
// Allowed in this file (the validator itself) via SKIP marker.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const BANNED = ["PagePort", "LLM Export", "LLM Page Export", "llm-export"];
const ROOTS = ["extension-src", "wp-plugin", "src", "public"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next"]);
const SKIP_EXT = new Set([".zip", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".pdf"]);
const SKIP_FILES = new Set(["check-brand-name.mjs"]);

const violations = [];
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (s.isFile() && !SKIP_EXT.has(extname(p)) && !SKIP_FILES.has(name)) {
      const text = readFileSync(p, "utf8");
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Allow intentional legacy-migration references (must mention "legacy").
        if (/legacy/i.test(line)) continue;
        for (const tok of BANNED) {
          if (line.includes(tok)) violations.push(`${p}:${i + 1}: ${tok}`);
        }
      }
    }
  }
}

for (const r of ROOTS) walk(r);

if (violations.length) {
  console.error("[check-brand-name] Banned tokens found:");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log("[check-brand-name] OK — no banned tokens.");