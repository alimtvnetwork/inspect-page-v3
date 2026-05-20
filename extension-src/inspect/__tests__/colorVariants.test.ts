import { describe, it, expect } from "vitest";
import { buildToken, buildTokens, TINT_DELTA, SHADE_DELTA } from "../colorVariants";
import { parseHex, rgbToHsl, shiftLightness, hslToHex } from "../colorMath";
import type { ColorUsage } from "../types";

const usage = (value: string, category: ColorUsage["category"], instances = 1): ColorUsage => ({
  value, category, instances, transparent: false,
});

describe("hslToHex", () => {
  it("round-trips representative colors within 1 channel", () => {
    for (const hex of ["#0b1220", "#ffbb00", "#7cb7ff", "#243056", "#f3f4f6"]) {
      const rgb = parseHex(hex)!;
      const hsl = rgbToHsl(rgb);
      const out = parseHex(hslToHex(hsl))!;
      expect(Math.abs(out.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(out.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(out.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe("shiftLightness", () => {
  it("clamps to [4,96] and preserves hue/saturation", () => {
    const black = { h: 0, s: 0, l: 0, a: 1 };
    expect(shiftLightness(black, -50).l).toBe(4);
    const white = { h: 0, s: 0, l: 100, a: 1 };
    expect(shiftLightness(white, +50).l).toBe(96);
    const mid = { h: 200, s: 60, l: 50, a: 1 };
    const t = shiftLightness(mid, 10);
    expect(t).toEqual({ h: 200, s: 60, l: 60, a: 1 });
  });
});

describe("buildToken", () => {
  it("returns null for non-hex input (e.g. gradient)", () => {
    expect(buildToken(usage("linear-gradient(0deg, red, blue)", "gradient"), 1, 1)).toBeNull();
  });

  it("produces three variants with HEX/RGB/HSL fields", () => {
    const tok = buildToken(usage("#ffbb00", "background", 7), 3, 2)!;
    expect(tok.token).toBe("--ip-color-3");
    expect(tok.humanName).toBe("Surface 2");
    expect(tok.category).toBe("background");
    expect(tok.instances).toBe(7);
    expect(tok.base.hex).toBe("#ffbb00");
    expect(tok.base.rgb).toBe("rgb(255, 187, 0)");
    expect(tok.base.hsl).toBe("hsl(44, 100%, 50%)");
    // Tint/shade shifted in the right direction.
    const baseL = rgbToHsl(parseHex(tok.base.hex)!).l;
    const tintL = rgbToHsl(parseHex(tok.tint.hex)!).l;
    const shadeL = rgbToHsl(parseHex(tok.shade.hex)!).l;
    expect(tintL).toBeGreaterThan(baseL);
    expect(shadeL).toBeLessThan(baseL);
  });

  it("uses TINT_DELTA / SHADE_DELTA constants", () => {
    expect(TINT_DELTA).toBeGreaterThan(0);
    expect(SHADE_DELTA).toBeLessThan(0);
  });
});

describe("buildTokens", () => {
  it("assigns 1-based token indices and per-category ranks", () => {
    const tokens = buildTokens([
      usage("#0b1220", "background", 10),
      usage("#111a2e", "background", 8),
      usage("#f3f4f6", "text", 20),
      usage("linear-gradient(0deg,red,blue)", "gradient", 1),
      usage("#94a3b8", "text", 5),
    ]);
    expect(tokens.map((t) => t.token)).toEqual([
      "--ip-color-1", "--ip-color-2", "--ip-color-3", "--ip-color-4",
    ]);
    expect(tokens.map((t) => t.humanName)).toEqual([
      "Surface 1", "Surface 2", "Text 1", "Text 2",
    ]);
  });
});