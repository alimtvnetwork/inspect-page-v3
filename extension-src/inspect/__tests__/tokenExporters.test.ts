import { describe, it, expect } from "vitest";
import {
  tokensToMarkdown, tokensToCssTokens, tokensToPerSelectorCss, tokensToJson,
} from "../exportSnapshot";
import { buildTokens } from "../colorVariants";
import { buildColorSelectorIndex } from "../colorSelectorIndex";
import type { ColorUsage, ComputedSample } from "../types";

const usage = (v: string, c: ColorUsage["category"], n = 1): ColorUsage => ({
  value: v, category: c, instances: n, transparent: false,
});

const sample = (selector: string, styles: Partial<ComputedSample["styles"]>): ComputedSample => ({
  selector, tagName: "div", classList: [],
  rect: { x: 0, y: 0, w: 0, h: 0 },
  styles: {
    display: "block", position: "static",
    color: "", backgroundColor: "",
    fontFamily: "", fontSize: "16px", fontWeight: "400",
    lineHeight: "normal", margin: "0", padding: "0", border: "",
    ...styles,
  },
});

const palette: ColorUsage[] = [
  usage("#0b1220", "background", 10),
  usage("#ffbb00", "background", 4),
  usage("#f3f4f6", "text", 8),
];
const tokens = buildTokens(palette);
const samples: ComputedSample[] = [
  sample(".page", { backgroundColor: "rgb(11, 18, 32)", color: "rgb(243, 244, 246)" }),
  sample(".btn",  { backgroundColor: "rgb(255, 187, 0)" }),
];
const idx = buildColorSelectorIndex(samples);

describe("tokensToMarkdown", () => {
  it("emits the token format table + selector map", () => {
    const md = tokensToMarkdown(tokens, idx);
    expect(md).toContain("## Color tokens");
    expect(md).toContain("| Token | Human name | HEX | RGB | HSL |");
    expect(md).toContain("`--ip-color-1`");
    expect(md).toContain("Surface 1");
    expect(md).toContain("`#0b1220`");
    expect(md).toContain("`rgb(11, 18, 32)`");
    expect(md).not.toContain("## Variants");
    expect(md).not.toContain("| Token | Tint | Base | Shade |");
    expect(md).toContain("## Selector map");
    expect(md).toContain("`.page` { background-color }");
    expect(md).toContain("`.btn` { background-color }");
  });

  it("returns empty string when no tokens", () => {
    expect(tokensToMarkdown([], new Map())).toBe("");
  });
});

describe("tokensToCssTokens", () => {
  it("emits :root with one base token per color", () => {
    const css = tokensToCssTokens(tokens);
    expect(css).toContain(":root {");
    expect(css).toContain("--ip-color-1: #0b1220;");
    expect(css).not.toContain("--ip-color-1-tint:");
    expect(css).not.toContain("--ip-color-1-shade:");
    expect(css).toContain("--ip-color-3: #f3f4f6;");
    expect(css.trim().endsWith("}")).toBe(true);
  });
});

describe("tokensToPerSelectorCss", () => {
  it("groups by selector and references the matching token", () => {
    const css = tokensToPerSelectorCss(tokens, idx);
    expect(css).toContain(".page {");
    expect(css).toContain("background-color: var(--ip-color-1);");
    expect(css).toContain("color: var(--ip-color-3);");
    expect(css).toContain(".btn {");
    expect(css).toContain("background-color: var(--ip-color-2);");
  });

  it("appends custom CSS body inside the rule", () => {
    const css = tokensToPerSelectorCss(tokens, idx, {
      ".btn": "border-radius: 8px;\nbox-shadow: 0 2px 6px rgba(0,0,0,0.2);",
    });
    expect(css).toMatch(/\.btn \{[\s\S]*border-radius: 8px;[\s\S]*box-shadow:[\s\S]*\}/);
  });

  it("emits selectors that only have custom CSS (no detected colors)", () => {
    const css = tokensToPerSelectorCss(tokens, idx, {
      ".extra": "outline: 2px dashed currentColor;",
    });
    expect(css).toContain(".extra {");
    expect(css).toContain("outline: 2px dashed currentColor;");
  });
});

describe("tokensToJson", () => {
  it("is valid JSON containing tokens + selectorMap + customCss", () => {
    const json = tokensToJson(tokens, idx, { ".btn": "border-radius: 8px;" });
    const parsed = JSON.parse(json);
    expect(parsed.tokens).toHaveLength(3);
    expect(parsed.tokens[0].token).toBe("--ip-color-1");
    expect(parsed.selectorMap["#0b1220"][0].selector).toBe(".page");
    expect(parsed.customCss[".btn"]).toBe("border-radius: 8px;");
  });
});