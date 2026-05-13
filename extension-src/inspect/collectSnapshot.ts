/**
 * Phase A2 — Page snapshot collector for Inspect Mode.
 *
 * Runs in the page's main world (content script). Walks the DOM once and
 * returns a serializable {@link InspectSnapshot}. Subsequent phases consume
 * the snapshot to render Overview, Typography, Colors, Contrast Scanner,
 * CSS Information, and the Inspector.
 *
 * Design notes:
 *  - Pure DOM read; no mutations, no network calls.
 *  - Bounded work: caps the element walk and per-element sampling so very
 *    large pages (10k+ nodes) still finish in well under 1s.
 *  - Cached per-tab in {@link snapshotCache} keyed by document URL.
 */

import type {
  ColorCategory,
  ColorUsage,
  ComputedSample,
  CssStats,
  FontGeneric,
  FontUsage,
  InspectSnapshot,
  PageInfo,
  TextNodeSample,
} from "./types";

const MAX_ELEMENTS = 6000;
const MAX_COMPUTED_SAMPLES = 400;
const MAX_TEXT_NODES = 200;
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

/* -------------------- Color utilities -------------------- */

/**
 * Normalize a CSS color string to lowercase `#rrggbb` (alpha 1) or
 * `#rrggbbaa` (alpha < 1). Returns `null` for `transparent`, `none`,
 * empty, or unparseable inputs (keywords other than the basic set are
 * resolved by the browser before being passed in via getComputedStyle).
 */
export function normalizeColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v || v === "transparent" || v === "none" || v === "currentcolor") return null;
  // rgb(a) — what getComputedStyle returns in every modern browser
  const m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const r = clamp255(Number(m[1]));
    const g = clamp255(Number(m[2]));
    const b = clamp255(Number(m[3]));
    const a = m[4] === undefined ? 1 : parseAlpha(m[4]);
    if (a >= 0.999) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    if (a <= 0.001) return null;
    return `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(Math.round(a * 255))}`;
  }
  // Already a hex literal
  if (/^#([0-9a-f]{3,8})$/.test(v)) return expandHex(v);
  return null;
}

function clamp255(n: number): number { return Math.max(0, Math.min(255, Math.round(n))); }
function hex2(n: number): string { return n.toString(16).padStart(2, "0"); }
function parseAlpha(s: string): number {
  if (s.endsWith("%")) return Number(s.slice(0, -1)) / 100;
  return Number(s);
}
function expandHex(v: string): string {
  const h = v.slice(1);
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  if (h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return `#${h}`;
}

/* -------------------- Font utilities -------------------- */

export function genericForFamily(stack: string): FontGeneric {
  const s = stack.toLowerCase();
  if (s.includes("monospace")) return "monospace";
  if (s.includes("system-ui") || s.includes("-apple-system")) return "system-ui";
  if (s.includes("serif") && !s.includes("sans-serif")) return "serif";
  if (s.includes("sans-serif")) return "sans-serif";
  if (s.includes("cursive")) return "cursive";
  if (s.includes("fantasy")) return "fantasy";
  return "unknown";
}

export function primaryFamily(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "");
}

/* -------------------- Selector helper -------------------- */

function shortSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = (el.className && typeof el.className === "string")
    ? el.className.trim().split(/\s+/).slice(0, 2).join(".")
    : "";
  return cls ? `${tag}.${cls}` : tag;
}

/* -------------------- Main collector -------------------- */

export interface CollectOptions {
  /** Override for tests (defaults to globalThis.document). */
  doc?: Document;
  /** Override for tests (defaults to globalThis.window). */
  win?: Window;
}

export function collectSnapshot(opts: CollectOptions = {}): InspectSnapshot {
  const doc = opts.doc ?? globalThis.document;
  const win = opts.win ?? globalThis.window;
  if (!doc || !win) throw new Error("collectSnapshot: no document/window available");

  const pageInfo: PageInfo = {
    url: doc.location?.href ?? "",
    title: doc.title ?? "",
    origin: doc.location?.origin ?? "",
    viewport: { w: win.innerWidth ?? 0, h: win.innerHeight ?? 0 },
    documentSize: {
      w: doc.documentElement?.scrollWidth ?? 0,
      h: doc.documentElement?.scrollHeight ?? 0,
    },
  };

  // ---- Walk elements ----
  const all = Array.from(doc.querySelectorAll<HTMLElement>("*")).slice(0, MAX_ELEMENTS);

  const colorCounts = new Map<string, { cat: ColorCategory; count: number; transparent: boolean }>();
  const fontMap = new Map<string, {
    stack: string; group: "heading" | "body";
    weights: Set<number>; sizes: Set<number>; count: number;
  }>();
  const computedSamples: ComputedSample[] = [];
  const textNodes: TextNodeSample[] = [];

  const addColor = (value: string | null, cat: ColorCategory): void => {
    if (!value) return;
    const transparent = value.length === 9; // #rrggbbaa
    const key = `${cat}::${value}`;
    const cur = colorCounts.get(key);
    if (cur) cur.count++;
    else colorCounts.set(key, { cat, count: 1, transparent });
  };

  for (const el of all) {
    const cs = win.getComputedStyle(el);

    addColor(normalizeColor(cs.color), "text");
    addColor(normalizeColor(cs.backgroundColor), "background");
    if (cs.borderTopWidth !== "0px") addColor(normalizeColor(cs.borderTopColor), "border");
    if (el instanceof SVGElement) {
      addColor(normalizeColor(cs.fill), "fill");
      addColor(normalizeColor(cs.stroke), "stroke");
    }
    // Gradients live in background-image
    const bgImg = cs.backgroundImage;
    if (bgImg && bgImg.includes("gradient(")) {
      const key = `gradient::${bgImg}`;
      const cur = colorCounts.get(key);
      if (cur) cur.count++;
      else colorCounts.set(key, { cat: "gradient", count: 1, transparent: false });
    }

    // Font tracking
    const stack = cs.fontFamily;
    if (stack) {
      const isHeading = HEADING_TAGS.has(el.tagName);
      const family = primaryFamily(stack);
      const group: "heading" | "body" = isHeading ? "heading" : "body";
      const key = `${group}::${family}`;
      let entry = fontMap.get(key);
      if (!entry) {
        entry = { stack, group, weights: new Set(), sizes: new Set(), count: 0 };
        fontMap.set(key, entry);
      }
      const weight = Number(cs.fontWeight) || 400;
      const sizePx = Math.round(parseFloat(cs.fontSize) || 0);
      entry.weights.add(weight);
      if (sizePx > 0) entry.sizes.add(sizePx);
      entry.count++;
    }

    // Computed samples (capped)
    if (computedSamples.length < MAX_COMPUTED_SAMPLES) {
      const r = el.getBoundingClientRect();
      computedSamples.push({
        selector: shortSelector(el),
        tagName: el.tagName.toLowerCase(),
        classList: Array.from(el.classList).slice(0, 6),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        styles: {
          display: cs.display,
          position: cs.position,
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          margin: cs.margin,
          padding: cs.padding,
          border: cs.border,
        },
      });
    }

    // Text node sample (only if direct text content)
    if (textNodes.length < MAX_TEXT_NODES && hasDirectText(el)) {
      textNodes.push({
        selector: shortSelector(el),
        text: directText(el).slice(0, 80),
        fontFamily: cs.fontFamily,
        fontSizePx: Math.round(parseFloat(cs.fontSize) || 0),
        fontWeight: Number(cs.fontWeight) || 400,
        color: normalizeColor(cs.color) ?? cs.color,
        backgroundColor: normalizeColor(cs.backgroundColor) ?? cs.backgroundColor,
      });
    }
  }

  // ---- Aggregate fonts ----
  const fonts: FontUsage[] = Array.from(fontMap.values())
    .map((f) => ({
      family: primaryFamily(f.stack),
      stack: f.stack,
      generic: genericForFamily(f.stack),
      weights: Array.from(f.weights).sort((a, b) => a - b),
      sizesPx: Array.from(f.sizes).sort((a, b) => a - b),
      group: f.group,
      sampleCount: f.count,
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount);

  // ---- Aggregate colors ----
  const colors: ColorUsage[] = Array.from(colorCounts.entries())
    .map(([key, v]) => {
      const value = key.slice(key.indexOf("::") + 2);
      return { value, category: v.cat, instances: v.count, transparent: v.transparent };
    })
    .sort((a, b) => b.instances - a.instances);

  // ---- CSS stats ----
  const cssStats = collectCssStats(doc);

  return {
    pageInfo,
    fonts,
    colors,
    cssStats,
    computedSamples,
    textNodes,
    collectedAt: Date.now(),
  };
}

function hasDirectText(el: Element): boolean {
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3 && (n.textContent ?? "").trim().length > 0) return true;
  }
  return false;
}
function directText(el: Element): string {
  let out = "";
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) out += n.textContent ?? "";
  }
  return out.trim();
}

function collectCssStats(doc: Document): CssStats {
  let ruleCount = 0;
  let cssBytes = 0;
  let inlineStyleTagCount = 0;
  let unreachableSheetCount = 0;
  let externalSheetCount = 0;

  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      ruleCount += rules.length;
      for (const r of Array.from(rules)) cssBytes += (r.cssText?.length ?? 0);
      if (sheet.href) externalSheetCount++;
    } catch {
      unreachableSheetCount++;
      if ((sheet as CSSStyleSheet).href) externalSheetCount++;
    }
  }
  inlineStyleTagCount = doc.querySelectorAll("style").length;
  return { ruleCount, cssBytes, inlineStyleTagCount, unreachableSheetCount, externalSheetCount };
}

/* -------------------- Per-tab cache -------------------- */

const snapshotCache = new Map<string, InspectSnapshot>();

/** Return a cached snapshot for `key` (typically the page URL), or compute one. */
export function getOrCollectSnapshot(key: string, opts?: CollectOptions): InspectSnapshot {
  const cached = snapshotCache.get(key);
  if (cached) return cached;
  const snap = collectSnapshot(opts);
  snapshotCache.set(key, snap);
  return snap;
}

export function invalidateSnapshot(key: string): void {
  snapshotCache.delete(key);
}

export function clearSnapshotCache(): void {
  snapshotCache.clear();
}