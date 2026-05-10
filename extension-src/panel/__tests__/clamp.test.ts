import { describe, expect, it } from "vitest";
import { clamp } from "../clamp";

describe("clamp", () => {
  it("returns value when in range", () => expect(clamp(50, 0, 100)).toBe(50));
  it("clamps to min", () => expect(clamp(-5, 0, 100)).toBe(0));
  it("clamps to max", () => expect(clamp(150, 0, 100)).toBe(100));
  it("returns min for NaN", () => expect(clamp(Number.NaN, 0, 100)).toBe(0));
  it("returns min when range inverted", () => expect(clamp(50, 100, 0)).toBe(100));
});
