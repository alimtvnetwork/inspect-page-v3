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

/**
 * HSL → RGB → `#rrggbb` (or `#rrggbbaa` when alpha < 1).
 * Pure; mirrors the inverse of {@link rgbToHsl} so round-trips are stable.
 */
export function hslToHex(c: HslColor): string {
  const h = ((c.h % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, c.s)) / 100;
  const l = Math.max(0, Math.min(100, c.l)) / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  const h2 = (n: number): string => n.toString(16).padStart(2, "0");
  const base = `#${h2(r)}${h2(g)}${h2(b)}`;
  if (c.a >= 0.999) return base;
  return `${base}${h2(Math.max(0, Math.min(255, Math.round(c.a * 255))))}`;
}

/**
 * Return a copy of `c` with lightness shifted by `delta` percent points and
 * clamped to [minL, maxL] so we never produce pure black/white. Preserves
 * hue, saturation and alpha.
 */
export function shiftLightness(c: HslColor, delta: number, minL = 4, maxL = 96): HslColor {
  const l = Math.max(minL, Math.min(maxL, c.l + delta));
  return { h: c.h, s: c.s, l, a: c.a };
}