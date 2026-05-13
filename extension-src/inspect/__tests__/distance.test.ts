import { describe, it, expect } from "vitest";
import { distanceBetween } from "../distance";

describe("distanceBetween", () => {
  it("computes gaps for fully separated rectangles (target right of anchor)", () => {
    const d = distanceBetween({ x: 0, y: 0, w: 100, h: 50 }, { x: 200, y: 80, w: 60, h: 40 });
    expect(d.hGap).toBe(100); // 200 - 100
    expect(d.vGap).toBe(30);  // 80 - 50
    expect(d.left).toBe(-200);
    expect(d.overlap).toBe(false);
  });

  it("flags overlap when rectangles intersect on both axes", () => {
    const d = distanceBetween({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50, w: 100, h: 100 });
    expect(d.overlap).toBe(true);
    expect(d.hGap).toBeLessThan(0);
    expect(d.vGap).toBeLessThan(0);
  });

  it("uses absolute positive gap when target is left of anchor", () => {
    const d = distanceBetween({ x: 300, y: 0, w: 100, h: 50 }, { x: 0, y: 0, w: 100, h: 50 });
    expect(d.hGap).toBe(200); // 300 - 100
  });
});