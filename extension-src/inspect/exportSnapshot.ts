/**
 * Phase A11 — Export hardening for Inspect Mode.
 *
 * Pure serializers that turn an {@link InspectSnapshot} (or one of its
 * sub-collections) into safe text payloads. No DOM, no downloads — the
 * download trigger lives in the panel layer.
 *
 *  - toCsv:      RFC-4180 escaping (quotes, commas, newlines).
 *  - toJson:     stable, pretty-printed JSON.
 *  - toMarkdown: human-readable summary suitable for AI hand-off.
 *  - safeBaseName: filesystem-safe filename derived from page URL.
 */
import type { InspectSnapshot, ColorUsage, FontUsage } from "./types";

/* ---------- CSV ---------- */

/** RFC-4180 cell escape: wrap in quotes when value contains `"`, `,`, or any newline. */
export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return body ? `${head}\n${body}\n` : `${head}\n`;
}

export function colorsToCsv(colors: readonly ColorUsage[]): string {
  return toCsv(
    ["value", "category", "instances", "transparent"],
    colors.map((c) => [c.value, c.category, c.instances, c.transparent]),
  );
}

export function fontsToCsv(fonts: readonly FontUsage[]): string {
  return toCsv(
    ["family", "group", "generic", "weights", "sizesPx", "sampleCount", "stack"],
    fonts.map((f) => [
      f.family, f.group, f.generic,
      f.weights.join("|"),
      f.sizesPx.join("|"),
      f.sampleCount,
      f.stack,
    ]),
  );
}

/* ---------- JSON ---------- */

export function toJson(snapshot: InspectSnapshot): string {
  // Re-construct in stable key order so diffs across runs are readable.
  const ordered = {
    pageInfo: snapshot.pageInfo,
    fonts: snapshot.fonts,
    colors: snapshot.colors,
    cssStats: snapshot.cssStats,
    textNodes: snapshot.textNodes,
    computedSamples: snapshot.computedSamples,
    collectedAt: snapshot.collectedAt,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/* ---------- Markdown ---------- */

export function toMarkdown(snapshot: InspectSnapshot): string {
  const { pageInfo, fonts, colors, cssStats } = snapshot;
  const out: string[] = [];
  out.push(`# Inspect Page report`);
  out.push("");
  out.push(`- **URL:** ${pageInfo.url}`);
  if (pageInfo.title) out.push(`- **Title:** ${pageInfo.title}`);
  out.push(`- **Viewport:** ${pageInfo.viewport.w} × ${pageInfo.viewport.h}`);
  out.push(`- **Document:** ${pageInfo.documentSize.w} × ${pageInfo.documentSize.h}`);
  out.push(`- **Collected:** ${new Date(snapshot.collectedAt).toISOString()}`);
  out.push("");

  out.push(`## CSS`);
  out.push(`- Rule count: ${cssStats.ruleCount}`);
  out.push(`- Inlined CSS bytes: ${cssStats.cssBytes}`);
  out.push(`- External stylesheets: ${cssStats.externalSheetCount}`);
  out.push(`- \`<style>\` tags: ${cssStats.inlineStyleTagCount}`);
  out.push(`- Unreachable (CORS) sheets: ${cssStats.unreachableSheetCount}`);
  out.push("");

  if (fonts.length > 0) {
    out.push(`## Fonts`);
    out.push(`| Group | Family | Weights | Sizes (px) | Samples |`);
    out.push(`| --- | --- | --- | --- | --- |`);
    for (const f of fonts) {
      out.push(`| ${f.group} | ${mdEscape(f.family)} | ${f.weights.join(", ")} | ${f.sizesPx.join(", ")} | ${f.sampleCount} |`);
    }
    out.push("");
  }

  if (colors.length > 0) {
    out.push(`## Colors`);
    out.push(`| Value | Category | Instances |`);
    out.push(`| --- | --- | --- |`);
    for (const c of colors) {
      out.push(`| \`${mdEscape(c.value)}\` | ${c.category} | ${c.instances} |`);
    }
    out.push("");
  }

  return out.join("\n");
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/* ---------- Filename helpers ---------- */

/**
 * Derive a filesystem-safe base filename like `inspect-page-example-com-2026-05-13`
 * from the page URL + collection timestamp. Falls back to `inspect-page-snapshot`.
 */
export function safeBaseName(snapshot: InspectSnapshot, prefix = "inspect-page"): string {
  let host = "snapshot";
  try {
    const u = new URL(snapshot.pageInfo.url);
    host = u.hostname.replace(/^www\./, "") || "snapshot";
  } catch { /* keep fallback */ }
  const slug = host.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const date = new Date(snapshot.collectedAt).toISOString().slice(0, 10);
  return `${prefix}-${slug || "snapshot"}-${date}`;
}

/** Map a logical export kind to (mime, extension). */
export function mimeFor(kind: "csv" | "json" | "md"): { mime: string; ext: string } {
  switch (kind) {
    case "csv":  return { mime: "text/csv;charset=utf-8", ext: "csv" };
    case "json": return { mime: "application/json;charset=utf-8", ext: "json" };
    case "md":   return { mime: "text/markdown;charset=utf-8", ext: "md" };
  }
}