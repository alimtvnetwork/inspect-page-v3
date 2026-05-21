import { describe, it, expect } from "vitest";
import { synthesizeCode } from "../synthesize-code";
import type { ComputedSample } from "../types";

const sample: ComputedSample = {
  selector: "div.card",
  tagName: "div",
  classList: ["card", "card--lg"],
  rect: { x: 0, y: 0, w: 100, h: 50 },
  styles: {
    display: "flex",
    position: "",
    color: "rgb(0, 0, 0)",
    backgroundColor: "rgb(255, 255, 255)",
    fontFamily: "Inter",
    fontSize: "14px",
    fontWeight: "500",
    lineHeight: "20px",
    margin: "0px",
    padding: "8px",
    border: "1px solid rgb(229, 231, 235)",
  },
};

describe("synthesizeCode", () => {
  it("includes class list in HTML opening tag", () => {
    const { html } = synthesizeCode(sample);
    expect(html).toContain('class="card card--lg"');
    expect(html.startsWith("<div")).toBe(true);
  });

  it("emits selector { ... } CSS with kebab-case props and skips empty values", () => {
    const { css } = synthesizeCode(sample);
    expect(css.startsWith("div.card {")).toBe(true);
    expect(css).toContain("background-color: rgb(255, 255, 255);");
    expect(css).toContain("font-family: Inter;");
    expect(css).not.toContain("position:");
  });

  it("escapes class attribute special chars", () => {
    const evil = { ...sample, classList: ['a"b', "c<d"] };
    const { html } = synthesizeCode(evil);
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;");
  });
});