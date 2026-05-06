import { describe, expect, it } from "vitest";
import { format } from "../format";

describe("format", () => {
  it("substitutes named placeholders", () => {
    expect(format("Capturing {done}/{total}", { done: 3, total: 12 })).toBe("Capturing 3/12");
  });
  it("preserves unmatched placeholders", () => {
    expect(format("Hello {name}", {})).toBe("Hello {name}");
  });
  it("handles strings, numbers, and zero", () => {
    expect(format("a={a} b={b}", { a: 0, b: "x" })).toBe("a=0 b=x");
  });
});
