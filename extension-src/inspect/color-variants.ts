/**
 * Phase v2.7.5 — Color Tokens v2 engine.
 *
 * Pure module that converts the deduplicated palette (ColorUsage[]) into a
 * list of {@link ColorToken}s — each with a stable `--ip-color-N` name,
 * a human-readable label per category, and copy-ready HEX/RGB/HSL strings.
 */
import type { ColorCategory, ColorToken, ColorUsage, ColorVariant } from "./types";
import {
  parseHex, rgbToHsl, formatRgb, formatHsl, hslToHex, shiftLightness,
  type HslColor, type RgbColor,
} from "./color-math";

/** Lightness delta (percentage points) for tint / shade variants. */
export const TINT_DELTA = 12;
export const SHADE_DELTA = -12;

const CATEGORY_LABEL: Record<ColorCategory, string> = {
  background: "Surface",
  text: "Text",
  border: "Edge",
  fill: "Fill",
  stroke: "Stroke",
  gradient: "Gradient",
  shadow: "Shadow",
  other: "Color",
};

/** Build a ColorVariant from an HSL triple (alpha-aware). */
function variantFromHsl(name: string, hsl: HslColor): ColorVariant {
  const hex = hslToHex(hsl);
  const rgb = parseHex(hex);
  const rgbStr = rgb ? formatRgb(rgb) : "";
  return { name, hex, rgb: rgbStr, hsl: formatHsl(hsl) };
}

/** Build a ColorVariant directly from RGB (used for the base, to preserve fidelity). */
function variantFromRgb(name: string, rgb: RgbColor): ColorVariant {
  const hsl = rgbToHsl(rgb);
  const h2 = (n: number): string => n.toString(16).padStart(2, "0");
  const baseHex = `#${h2(rgb.r)}${h2(rgb.g)}${h2(rgb.b)}` +
    (rgb.a < 0.999 ? h2(Math.max(0, Math.min(255, Math.round(rgb.a * 255)))) : "");
  return {
    name,
    hex: baseHex,
    rgb: formatRgb(rgb),
    hsl: formatHsl(hsl),
  };
}

/**
 * Convert a single {@link ColorUsage} into a {@link ColorToken}.
 * Returns `null` when the value is not a parseable hex (e.g. gradients).
 */
export function buildToken(
  usage: ColorUsage,
  tokenIndex: number,
  categoryRank: number,
): ColorToken | null {
  const rgb = parseHex(usage.value);
  if (!rgb) return null;

  const baseHsl = rgbToHsl(rgb);
  const tintHsl = shiftLightness(baseHsl, TINT_DELTA);
  const shadeHsl = shiftLightness(baseHsl, SHADE_DELTA);

  return {
    token: `--ip-color-${tokenIndex}`,
    humanName: `${CATEGORY_LABEL[usage.category]} ${categoryRank}`,
    category: usage.category,
    base: variantFromRgb("base", rgb),
    tint: variantFromHsl("tint", tintHsl),
    shade: variantFromHsl("shade", shadeHsl),
    instances: usage.instances,
  };
}

/**
 * Build the full token list from a deduplicated palette.
 * Non-hex entries (gradients) are dropped. Token indices are 1-based.
 */
export function buildTokens(palette: readonly ColorUsage[]): ColorToken[] {
  const out: ColorToken[] = [];
  const perCategory = new Map<ColorCategory, number>();
  let tokenIndex = 1;
  for (const usage of palette) {
    const rank = (perCategory.get(usage.category) ?? 0) + 1;
    const tok = buildToken(usage, tokenIndex, rank);
    if (!tok) continue;
    perCategory.set(usage.category, rank);
    out.push(tok);
    tokenIndex++;
  }
  return out;
}