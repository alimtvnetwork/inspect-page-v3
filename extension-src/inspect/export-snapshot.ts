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
import type { ColorCategory, ColorSelectorBinding, ColorToken } from "./types";
import { invertSelectorIndex } from "./color-selector-index";

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

/* ---------- Color tokens v2 ---------- */

/** Map of selector → user-edited custom CSS body (the inside of the `{ … }`). */
export type CustomCssMap = Readonly<Record<string, string>>;

/** Section labels per category — mirrors the v2 Dark Calendar palette layout. */
const SECTION_TITLE: Record<ColorCategory, string> = {
  background: "Surfaces (backgrounds)",
  border: "Borders",
  text: "Text",
  fill: "Fills",
  stroke: "Strokes",
  shadow: "Shadows",
  gradient: "Gradients",
  other: "Other",
};

const SECTION_ORDER: ColorCategory[] = [
  "background", "border", "text", "fill", "stroke", "shadow", "gradient", "other",
];

/**
 * Render the v2 Dark Calendar-style palette: one `### Section` per
 * category, each with a `| Token | Human name | HEX | RGB | HSL |` table.
 * Followed by a `## Selector map` section.
 */
export function tokensToMarkdown(
  tokens: readonly ColorToken[],
  index: ReadonlyMap<string, ColorSelectorBinding[]>,
): string {
  if (tokens.length === 0) return "";
  const out: string[] = [];

  out.push(`## Color tokens`);
  out.push("");

  const byCat = new Map<ColorCategory, ColorToken[]>();
  for (const t of tokens) {
    const arr = byCat.get(t.category) ?? [];
    arr.push(t);
    byCat.set(t.category, arr);
  }
  for (const cat of SECTION_ORDER) {
    const list = byCat.get(cat);
    if (!list || list.length === 0) continue;
    out.push(`### ${SECTION_TITLE[cat]}`);
    out.push("");
    out.push(`| Token | Human name | HEX | RGB | HSL |`);
    out.push(`|---|---|---|---|---|`);
    for (const t of list) {
      out.push(`| \`${t.token}\` | ${t.humanName} | \`${t.base.hex}\` | \`${t.base.rgb}\` | \`${t.base.hsl}\` |`);
    }
    out.push("");
  }

  out.push(`## Selector map`);
  out.push("");
  for (const t of tokens) {
    const bindings = index.get(t.base.hex) ?? [];
    out.push(`### \`${t.token}\` — ${t.humanName} (\`${t.base.hex}\`)`);
    if (bindings.length === 0) {
      out.push(`- _no selectors observed_`);
    } else {
      for (const b of bindings) out.push(`- \`${b.selector}\` { ${b.property} }`);
    }
    out.push("");
  }

  return out.join("\n");
}

/** `:root { --ip-color-1: #…; … }`. */
export function tokensToCssTokens(tokens: readonly ColorToken[]): string {
  if (tokens.length === 0) return "/* no tokens */\n";
  const lines: string[] = [`:root {`];
  for (const t of tokens) {
    lines.push(`  /* ${t.humanName} */`);
    lines.push(`  ${t.token}: ${t.base.hex};`);
  }
  lines.push(`}`);
  lines.push("");
  return lines.join("\n");
}

/**
 * One CSS block per selector with `property: var(--ip-color-N);` lines and
 * any user-supplied custom CSS body appended verbatim inside the rule.
 */
export function tokensToPerSelectorCss(
  tokens: readonly ColorToken[],
  index: ReadonlyMap<string, ColorSelectorBinding[]>,
  custom: CustomCssMap = {},
): string {
  const tokenByHex = new Map<string, ColorToken>();
  for (const t of tokens) tokenByHex.set(t.base.hex, t);

  const inv = invertSelectorIndex(index as Map<string, ColorSelectorBinding[]>);
  if (inv.size === 0 && Object.keys(custom).length === 0) return "/* no per-selector bindings */\n";

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const [selector, entries] of inv) {
    seen.add(selector);
    lines.push(`${selector} {`);
    for (const e of entries) {
      const tok = tokenByHex.get(e.hex);
      if (tok) lines.push(`  ${e.property}: var(${tok.token}); /* ${tok.humanName} */`);
      else     lines.push(`  ${e.property}: ${e.hex};`);
    }
    const extra = (custom[selector] ?? "").trim();
    if (extra) {
      for (const ln of extra.split(/\r?\n/)) lines.push(`  ${ln}`);
    }
    lines.push(`}`);
    lines.push("");
  }

  // Selectors that only have custom CSS (no detected colors).
  for (const [selector, body] of Object.entries(custom)) {
    if (seen.has(selector)) continue;
    const trimmed = body.trim();
    if (!trimmed) continue;
    lines.push(`${selector} {`);
    for (const ln of trimmed.split(/\r?\n/)) lines.push(`  ${ln}`);
    lines.push(`}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Machine-readable bundle: tokens + selector index + custom overrides. */
export function tokensToJson(
  tokens: readonly ColorToken[],
  index: ReadonlyMap<string, ColorSelectorBinding[]>,
  custom: CustomCssMap = {},
): string {
  const selectorMap: Record<string, ColorSelectorBinding[]> = {};
  for (const [hex, list] of index) selectorMap[hex] = list.map((b) => ({ ...b }));
  const ordered = { tokens, selectorMap, customCss: custom };
  return `${JSON.stringify(ordered, null, 2)}\n`;
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