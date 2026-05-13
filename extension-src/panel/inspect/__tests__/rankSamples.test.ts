import { describe, it, expect } from "vitest";
import { rankSamples } from "../InspectInspector";
import type { ComputedSample } from "../../../inspect/types";

function s(tag: string, w: number, h: number): ComputedSample {
  return {
    selector: tag, tagName: tag, classList: [],
    rect: { x: 0, y: 0, w, h }, styles: {},
  };
}

describe("rankSamples", () => {
  it("filters html/body and zero-size elements", () => {
    const out = rankSamples([
      s("html", 1000, 1000),
      s("body", 1000, 1000),
      s("div", 0, 100),
      s("section", 100, 100),
    ]);
    expect(out.map(o => o.tagName)).toEqual(["section"]);
  });

  it("sorts by visible area descending", () => {
    const out = rankSamples([
      s("a", 10, 10),
      s("b", 50, 50),
      s("c", 30, 30),
    ]);
    expect(out.map(o => o.tagName)).toEqual(["b", "c", "a"]);
  });
});