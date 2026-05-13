import { describe, it, expect } from "vitest";
import { contrastRatio, verdict, isLargeText, computeContrastPairs } from "../contrast";

describe("contrastRatio", () => {
  it("black on white = 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  });
  it("white on white = 1", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
  it("medium grey on white ≈ 4.5", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("verdict + isLargeText", () => {
  it("classifies AA/AAA flags", () => {
    const v = verdict(7);
    expect(v.normalAA).toBe(true);
    expect(v.normalAAA).toBe(true);
    expect(v.label).toBe("Excellent");
  });
  it("recognizes large text threshold", () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(19, 700)).toBe(true);
    expect(isLargeText(16, 700)).toBe(false);
  });
});

describe("computeContrastPairs", () => {
  it("dedupes and counts", () => {
    const pairs = computeContrastPairs([
      { selector: "p", text: "a", fontFamily: "x", fontSizePx: 14, fontWeight: 400, color: "#000000", backgroundColor: "#ffffff" },
      { selector: "p", text: "b", fontFamily: "x", fontSizePx: 14, fontWeight: 400, color: "#000000", backgroundColor: "#ffffff" },
      { selector: "p", text: "c", fontFamily: "x", fontSizePx: 14, fontWeight: 400, color: "#777777", backgroundColor: "#ffffff" },
    ]);
    expect(pairs.length).toBe(2);
    const black = pairs.find((p) => p.fg === "#000000")!;
    expect(black.instances).toBe(2);
  });
});