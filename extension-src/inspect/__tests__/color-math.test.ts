import { describe, it, expect } from "vitest";
import { parseHex, rgbToHsl, formatRgb, formatHsl } from "../color-math";

describe("colorMath", () => {
  it("parses #rrggbb with implicit alpha=1", () => {
    const c = parseHex("#ff0000");
    expect(c).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it("parses #rrggbbaa alpha", () => {
    const c = parseHex("#00ff0080");
    expect(c?.r).toBe(0); expect(c?.g).toBe(255); expect(c?.b).toBe(0);
    expect(c?.a).toBeCloseTo(128 / 255, 3);
  });

  it("rejects invalid hex", () => {
    expect(parseHex("rgb(0,0,0)")).toBeNull();
    expect(parseHex("#abc")).toBeNull(); // shorthand not supported (always normalized upstream)
  });

  it("converts pure red to HSL(0, 100, 50)", () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0, a: 1 });
    expect(hsl).toEqual({ h: 0, s: 100, l: 50, a: 1 });
  });

  it("formats rgb without alpha when a=1, rgba otherwise", () => {
    expect(formatRgb({ r: 1, g: 2, b: 3, a: 1 })).toBe("rgb(1, 2, 3)");
    expect(formatRgb({ r: 1, g: 2, b: 3, a: 0.5 })).toBe("rgba(1, 2, 3, 0.5)");
  });

  it("formats hsl/hsla", () => {
    expect(formatHsl({ h: 200, s: 50, l: 25, a: 1 })).toBe("hsl(200, 50%, 25%)");
    expect(formatHsl({ h: 200, s: 50, l: 25, a: 0.5 })).toBe("hsla(200, 50%, 25%, 0.5)");
  });
});