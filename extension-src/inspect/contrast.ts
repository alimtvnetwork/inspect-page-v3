/**
 * Phase A6 — WCAG 2.x contrast helpers.
 *
 * All inputs accepted as `#rrggbb` or `#rrggbbaa`. For alpha < 1 the colour
 * is composited over the supplied background (default white) before luminance
 * is computed.
 */

import type { TextNodeSample } from "./types";

export interface RGB { r: number; g: number; b: number; a: number }

export function parseHex(hex: string): RGB | null {
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex);
  if (!m) return null;
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
    a: m[2] ? parseInt(m[2], 16) / 255 : 1,
  };
}

function compositeOver(fg: RGB, bg: RGB): RGB {
  const a = fg.a + bg.a * (1 - fg.a);
  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / (a || 1),
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / (a || 1),
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / (a || 1),
    a: 1,
  };
}

function relativeLuminance(c: RGB): number {
  const f = (n: number) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** WCAG contrast ratio between two normalized colors. Returns 1 on bad input. */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return 1;
  const fgComp = fg.a < 1 ? compositeOver(fg, { ...bg, a: 1 }) : fg;
  const L1 = relativeLuminance(fgComp);
  const L2 = relativeLuminance({ ...bg, a: 1 });
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

export interface ContrastVerdict {
  ratio: number;
  label: "Fail" | "Poor" | "Good" | "Excellent";
  normalAA: boolean;
  normalAAA: boolean;
  largeAA: boolean;
  largeAAA: boolean;
}

export function verdict(ratio: number): ContrastVerdict {
  return {
    ratio,
    label: ratio >= 7 ? "Excellent" : ratio >= 4.5 ? "Good" : ratio >= 3 ? "Poor" : "Fail",
    normalAA: ratio >= 4.5,
    normalAAA: ratio >= 7,
    largeAA: ratio >= 3,
    largeAAA: ratio >= 4.5,
  };
}

/** True if `font-size + weight` qualifies as WCAG "large text". */
export function isLargeText(sizePx: number, weight: number): boolean {
  if (sizePx >= 24) return true;
  if (sizePx >= 18.66 && weight >= 700) return true;
  return false;
}

export interface ContrastPair {
  fg: string;          // normalized #rrggbb[aa]
  bg: string;          // normalized #rrggbb (alpha collapsed)
  ratio: number;
  verdict: ContrastVerdict;
  isLarge: boolean;
  instances: number;
  /** Sample text from the first occurrence (truncated). */
  sample: string;
}

/** Default surface used when a text node's background is transparent. */
const FALLBACK_BG = "#ffffff";

export function computeContrastPairs(textNodes: TextNodeSample[]): ContrastPair[] {
  const map = new Map<string, ContrastPair>();
  for (const t of textNodes) {
    const fgHex = parseHex(t.color)?.a !== undefined ? t.color : null;
    if (!fgHex) continue;
    const bgHex = /^#[0-9a-f]{6}$/i.test(t.backgroundColor) ? t.backgroundColor : FALLBACK_BG;
    const ratio = contrastRatio(fgHex, bgHex);
    const isLarge = isLargeText(t.fontSizePx, t.fontWeight);
    const key = `${fgHex.toLowerCase()}|${bgHex.toLowerCase()}|${isLarge ? "L" : "N"}`;
    const cur = map.get(key);
    if (cur) cur.instances++;
    else map.set(key, {
      fg: fgHex.toLowerCase(),
      bg: bgHex.toLowerCase(),
      ratio, verdict: verdict(ratio), isLarge,
      instances: 1,
      sample: t.text,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.ratio - b.ratio);
}