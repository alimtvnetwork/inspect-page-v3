import { describe, expect, it } from "vitest";
import { countMatchedRules } from "../run-element-export";

describe("countMatchedRules", () => {
  it("returns 0 for empty input", () => {
    expect(countMatchedRules("")).toBe(0);
  });
  it("counts top-level rule blocks", () => {
    const css = "a { color: red; } b.c, d { font-size: 12px; } /* note */ .e { padding: 0; }";
    expect(countMatchedRules(css)).toBe(3);
  });
  it("ignores nested at-rule inner braces", () => {
    const css = "@media (min-width: 1px) { a { color: red; } b { color: blue; } } .x { margin: 0; }";
    // top-level blocks: @media{...} and .x{...} → 2
    expect(countMatchedRules(css)).toBe(2);
  });
});