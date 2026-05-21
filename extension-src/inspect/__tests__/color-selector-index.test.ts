import { describe, it, expect } from "vitest";
import {
  buildColorSelectorIndex, invertSelectorIndex, MAX_BINDINGS_PER_COLOR,
} from "../color-selector-index";
import type { ComputedSample } from "../types";

const sample = (
  selector: string,
  styles: Partial<ComputedSample["styles"]>,
): ComputedSample => ({
  selector,
  tagName: "div",
  classList: [],
  rect: { x: 0, y: 0, w: 0, h: 0 },
  styles: {
    display: "block", position: "static",
    color: "", backgroundColor: "",
    fontFamily: "", fontSize: "16px", fontWeight: "400",
    lineHeight: "normal", margin: "0", padding: "0", border: "",
    ...styles,
  },
});

describe("buildColorSelectorIndex", () => {
  it("indexes color + background-color per selector and dedupes", () => {
    const idx = buildColorSelectorIndex([
      sample(".card", { backgroundColor: "rgb(17, 26, 46)", color: "rgb(243, 244, 246)" }),
      sample(".card", { backgroundColor: "rgb(17, 26, 46)", color: "rgb(243, 244, 246)" }),
      sample(".btn", { backgroundColor: "rgb(255, 187, 0)" }),
    ]);
    expect(idx.get("#111a2e")).toEqual([{ selector: ".card", property: "background-color" }]);
    expect(idx.get("#f3f4f6")).toEqual([{ selector: ".card", property: "color" }]);
    expect(idx.get("#ffbb00")).toEqual([{ selector: ".btn", property: "background-color" }]);
  });

  it("extracts border-color from border shorthand", () => {
    const idx = buildColorSelectorIndex([
      sample(".bx", { border: "1px solid rgb(36, 48, 86)" }),
    ]);
    expect(idx.get("#243056")).toEqual([{ selector: ".bx", property: "border-color" }]);
  });

  it("skips transparent / unparseable values", () => {
    const idx = buildColorSelectorIndex([
      sample(".t", { backgroundColor: "transparent", color: "currentcolor" }),
    ]);
    expect(idx.size).toBe(0);
  });

  it("caps bindings per color at MAX_BINDINGS_PER_COLOR", () => {
    const samples: ComputedSample[] = [];
    for (let i = 0; i < MAX_BINDINGS_PER_COLOR + 25; i++) {
      samples.push(sample(`.s-${i}`, { backgroundColor: "rgb(255, 187, 0)" }));
    }
    const idx = buildColorSelectorIndex(samples);
    expect(idx.get("#ffbb00")!.length).toBe(MAX_BINDINGS_PER_COLOR);
  });
});

describe("invertSelectorIndex", () => {
  it("produces a selector → bindings map without duplicates", () => {
    const fwd = buildColorSelectorIndex([
      sample(".card", { backgroundColor: "rgb(17, 26, 46)", color: "rgb(243, 244, 246)" }),
      sample(".btn", { backgroundColor: "rgb(255, 187, 0)" }),
    ]);
    const inv = invertSelectorIndex(fwd);
    expect(inv.get(".card")).toEqual([
      { hex: "#f3f4f6", property: "color" },
      { hex: "#111a2e", property: "background-color" },
    ]);
    expect(inv.get(".btn")).toEqual([{ hex: "#ffbb00", property: "background-color" }]);
  });
});