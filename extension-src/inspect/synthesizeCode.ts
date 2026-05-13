/**
 * Phase A9 — Snippet synthesizer for the Show Code drawer.
 *
 * Builds an illustrative HTML opening tag (with class list) and a CSS rule
 * from a {@link ComputedSample}. Pure, no DOM access; safe for the panel
 * context. Output is meant for AI hand-off, not byte-perfect reproduction.
 */
import type { ComputedSample } from "./types";

const CSS_PROPS: Array<[keyof ComputedSample["styles"], string]> = [
  ["display", "display"],
  ["position", "position"],
  ["color", "color"],
  ["backgroundColor", "background-color"],
  ["fontFamily", "font-family"],
  ["fontSize", "font-size"],
  ["fontWeight", "font-weight"],
  ["lineHeight", "line-height"],
  ["margin", "margin"],
  ["padding", "padding"],
  ["border", "border"],
];

export interface SynthCode { html: string; css: string }

export function synthesizeCode(sample: ComputedSample): SynthCode {
  const tag = sample.tagName || "div";
  const cls = sample.classList.length > 0 ? ` class="${escapeAttr(sample.classList.join(" "))}"` : "";
  const html = `<${tag}${cls}>\n  <!-- … -->\n</${tag}>`;

  const decls = CSS_PROPS
    .map(([k, prop]) => {
      const v = (sample.styles[k] ?? "").trim();
      return v ? `  ${prop}: ${v};` : null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
  const css = `${sample.selector} {\n${decls}\n}`;
  return { html, css };
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}