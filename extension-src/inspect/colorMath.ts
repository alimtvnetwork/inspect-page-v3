/**
 * Phase A10 — Color conversion utilities for the Detail drawer.
 *
 * Pure: takes `#rrggbb` or `#rrggbbaa` (lowercase) and returns RGB(A) and
 * HSL(A) tuples plus formatted CSS strings. Returns `null` for invalid
 * inputs (e.g. raw gradient values).
 */

export interface RgbColor { r: number; g: number; b: number; a: number }
export interface HslColor { h: number; s: number; l: number; a: number }

const HEX_RE = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

export function parseHex(value: string): RgbColor | null {
  const m = HEX_RE.exec(value.trim());
  if (!m) return null;
  const hex = m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = m[2] ? parseInt(m[2], 16) / 255 : 1;
  return { r, g, b, a };
}

export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100), a: rgb.a };
}

export function formatRgb(c: RgbColor): string {
  return c.a >= 0.999
    ? `rgb(${c.r}, ${c.g}, ${c.b})`
    : `rgba(${c.r}, ${c.g}, ${c.b}, ${trimAlpha(c.a)})`;
}

export function formatHsl(c: HslColor): string {
  return c.a >= 0.999
    ? `hsl(${c.h}, ${c.s}%, ${c.l}%)`
    : `hsla(${c.h}, ${c.s}%, ${c.l}%, ${trimAlpha(c.a)})`;
}

function trimAlpha(a: number): string {
  return Number(a.toFixed(3)).toString();
}