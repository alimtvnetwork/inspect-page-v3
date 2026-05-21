/**
 * C2 — Element snapshot for the rich Pick-Element Inspector view.
 *
 * Builds a self-contained, serializable snapshot of a single picked element:
 * identity, box-model, text properties, selection colors + contrast verdict,
 * matched rules grouped by pseudo-class, and a grouped computed-style diff.
 *
 * Pure read-only DOM access. Reuses existing helpers (matchedCss, contrast,
 * selectorPath). Safe to JSON.stringify.
 */
import { selectorPath } from "./selector-path";
import { xpathFor } from "./xpath";
import { matchedCss } from "./matched-css";
import { contrastRatio, isLargeText, verdict, type ContrastVerdict } from "../inspect/contrast";

export interface BoxSides { top: number; right: number; bottom: number; left: number }

export interface ElementSnapshot {
  identity: {
    tag: string;            // e.g. "button"
    id: string | null;
    classList: string[];
    role: string | null;
    selectorPath: string;
    xpath: string;          // absolute XPath, or //*[@id="..."] when id is unique
    label: string;          // e.g. "Button" — friendly name
    selectorChip: string;   // e.g. "button.relative"
  };
  box: {
    rect: { x: number; y: number; w: number; h: number };
    margin: BoxSides;
    border: BoxSides;
    padding: BoxSides;
    content: { w: number; h: number };
  };
  text: {
    fontFamily: string;
    fontSizePx: number;
    lineHeightPx: number | null;  // null when "normal"
    fontWeight: number;
    letterSpacing: string;
    color: string;          // #rrggbb[aa]
  };
  selection: {
    fg: string;             // #rrggbb[aa]
    bg: string;             // #rrggbb (resolved against ancestors)
    contrast: {
      ratio: number;
      verdict: ContrastVerdict;
      isLarge: boolean;
    };
  };
  matched: {
    base: string;           // raw matched-rule CSS
    hover: string;
    focus: string;
    active: string;
    disabled: string;
  };
  groupedDiff: {
    layout: Record<string, string>;
    typography: Record<string, string>;
    background: Record<string, string>;
    border: Record<string, string>;
    effects: Record<string, string>;
    other: Record<string, string>;
  };
}

const LAYOUT_PROPS = new Set([
  "display", "position", "top", "right", "bottom", "left", "inset",
  "float", "clear", "z-index", "box-sizing",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "justify-content", "align-items", "align-content", "align-self", "gap",
  "row-gap", "column-gap", "grid", "grid-template-columns", "grid-template-rows",
  "grid-area", "grid-column", "grid-row", "place-items", "place-content",
  "overflow", "overflow-x", "overflow-y", "visibility", "order",
]);
const TYPO_PROPS = new Set([
  "font", "font-family", "font-size", "font-weight", "font-style", "font-variant",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-decoration",
  "text-transform", "text-indent", "text-overflow", "white-space", "word-break",
  "color", "vertical-align",
]);
const BG_PROPS = new Set([
  "background", "background-color", "background-image", "background-size",
  "background-position", "background-repeat", "background-clip", "background-origin",
  "background-attachment",
]);
const BORDER_PROPS = new Set([
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-style", "border-width",
  "border-top-color", "border-top-style", "border-top-width",
  "border-right-color", "border-right-style", "border-right-width",
  "border-bottom-color", "border-bottom-style", "border-bottom-width",
  "border-left-color", "border-left-style", "border-left-width",
  "border-radius", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius",
  "outline", "outline-color", "outline-style", "outline-width", "outline-offset",
]);
const EFFECTS_PROPS = new Set([
  "opacity", "box-shadow", "filter", "backdrop-filter",
  "transform", "transform-origin", "transition", "animation",
  "mix-blend-mode", "isolation", "will-change",
]);

function num(v: string | undefined | null): number {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

function rgbToHex(value: string): string {
  // Accept "rgb(r,g,b)", "rgba(r,g,b,a)", or "#xxx" values.
  const v = (value || "").trim();
  if (!v || v === "transparent" || v === "rgba(0, 0, 0, 0)") return "#00000000";
  if (v.startsWith("#")) return v.length === 4
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase()
    : v.toLowerCase();
  const m = /rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?:\s*[,/ ]\s*([\d.]+))?\s*\)/i.exec(v);
  if (!m) return "#000000";
  const r = (+m[1]!).toString(16).padStart(2, "0");
  const g = (+m[2]!).toString(16).padStart(2, "0");
  const b = (+m[3]!).toString(16).padStart(2, "0");
  const aRaw = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255;
  const a = aRaw < 255 ? aRaw.toString(16).padStart(2, "0") : "";
  return `#${r}${g}${b}${a}`.toLowerCase();
}

/** Walk ancestors to find the first opaque background color. */
function resolveBackground(el: Element): string {
  let cur: Element | null = el;
  while (cur) {
    const cs = getComputedStyle(cur);
    const hex = rgbToHex(cs.backgroundColor);
    if (!hex.endsWith("00")) return hex.length === 9 ? hex.slice(0, 7) : hex;
    cur = cur.parentElement;
  }
  return "#ffffff";
}

function friendlyLabel(tag: string, role: string | null): string {
  if (role) return role.charAt(0).toUpperCase() + role.slice(1);
  const map: Record<string, string> = {
    a: "Link", button: "Button", input: "Input", textarea: "Textarea",
    select: "Select", img: "Image", svg: "SVG", h1: "Heading 1", h2: "Heading 2",
    h3: "Heading 3", h4: "Heading 4", h5: "Heading 5", h6: "Heading 6",
    p: "Paragraph", ul: "List", ol: "Ordered list", li: "List item",
    nav: "Navigation", header: "Header", footer: "Footer", main: "Main",
    section: "Section", article: "Article", aside: "Aside", form: "Form",
    label: "Label", div: "Container", span: "Text",
  };
  return map[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
}

function selectorChip(tag: string, classes: string[]): string {
  const cls = classes.slice(0, 1).map((c) => `.${c}`).join("");
  return `${tag}${cls}`;
}

function groupDiff(diff: Record<string, string>): ElementSnapshot["groupedDiff"] {
  const out: ElementSnapshot["groupedDiff"] = {
    layout: {}, typography: {}, background: {}, border: {}, effects: {}, other: {},
  };
  for (const [k, v] of Object.entries(diff)) {
    if (LAYOUT_PROPS.has(k)) out.layout[k] = v;
    else if (TYPO_PROPS.has(k)) out.typography[k] = v;
    else if (BG_PROPS.has(k)) out.background[k] = v;
    else if (BORDER_PROPS.has(k)) out.border[k] = v;
    else if (EFFECTS_PROPS.has(k)) out.effects[k] = v;
    else out.other[k] = v;
  }
  return out;
}

/** Group raw matched-rule CSS by pseudo-class. */
function splitByPseudo(css: string): Record<"base" | "hover" | "focus" | "active" | "disabled", string> {
  const buckets = { base: [] as string[], hover: [] as string[], focus: [] as string[],
    active: [] as string[], disabled: [] as string[] };
  // Split on rule boundaries — each block starts with `/* from: */`.
  const blocks = css.split(/\n(?=\/\* from:)/g);
  for (const block of blocks) {
    if (!block.trim()) continue;
    const head = block.split("{", 1)[0] ?? "";
    if (/:hover\b/.test(head)) buckets.hover.push(block);
    else if (/:focus(-visible|-within)?\b/.test(head)) buckets.focus.push(block);
    else if (/:active\b/.test(head)) buckets.active.push(block);
    else if (/:disabled\b/.test(head)) buckets.disabled.push(block);
    else buckets.base.push(block);
  }
  return {
    base: buckets.base.join("\n\n"),
    hover: buckets.hover.join("\n\n"),
    focus: buckets.focus.join("\n\n"),
    active: buckets.active.join("\n\n"),
    disabled: buckets.disabled.join("\n\n"),
  };
}

export interface CollectSnapshotOptions {
  /** When false, `matched.*` strings are empty (faster, no rule walk). */
  includeMatchedRules?: boolean;
  /** When false, `groupedDiff` is empty. */
  includeComputedStyles?: boolean;
}

export async function collectElementSnapshot(
  target: Element,
  opts: CollectSnapshotOptions = {},
): Promise<ElementSnapshot> {
  const cs = getComputedStyle(target);
  const r = target.getBoundingClientRect();

  const tag = target.tagName.toLowerCase();
  const id = target.id || null;
  const classList = Array.from(target.classList);
  const role = target.getAttribute("role");

  const margin: BoxSides = {
    top: num(cs.marginTop), right: num(cs.marginRight),
    bottom: num(cs.marginBottom), left: num(cs.marginLeft),
  };
  const border: BoxSides = {
    top: num(cs.borderTopWidth), right: num(cs.borderRightWidth),
    bottom: num(cs.borderBottomWidth), left: num(cs.borderLeftWidth),
  };
  const padding: BoxSides = {
    top: num(cs.paddingTop), right: num(cs.paddingRight),
    bottom: num(cs.paddingBottom), left: num(cs.paddingLeft),
  };
  const content = {
    w: Math.max(0, r.width - padding.left - padding.right - border.left - border.right),
    h: Math.max(0, r.height - padding.top - padding.bottom - border.top - border.bottom),
  };

  const fg = rgbToHex(cs.color);
  const bg = resolveBackground(target);
  const fontSize = num(cs.fontSize);
  const lhRaw = cs.lineHeight;
  const lineHeightPx = lhRaw === "normal" ? null : num(lhRaw);
  const fontWeight = parseInt(cs.fontWeight, 10) || 400;
  const ratio = contrastRatio(fg, bg);
  const isLarge = isLargeText(fontSize, fontWeight);

  const includeMatched = opts.includeMatchedRules !== false;
  const includeDiff = opts.includeComputedStyles !== false;

  let matched = { base: "", hover: "", focus: "", active: "", disabled: "" };
  if (includeMatched) {
    const m = await matchedCss(target, { include: true });
    matched = splitByPseudo(m.css);
  }

  let groupedDiff: ElementSnapshot["groupedDiff"] = {
    layout: {}, typography: {}, background: {}, border: {}, effects: {}, other: {},
  };
  if (includeDiff) {
    // Inline a tiny diff (avoid second iframe spawn): use the fact that
    // computedDiff already exists; lazy import to keep this module test-friendly.
    const { computedDiff } = await import("./computed-diff");
    groupedDiff = groupDiff(computedDiff(target, { include: true }));
  }

  return {
    identity: {
      tag, id, classList, role,
      selectorPath: selectorPath(target),
      xpath: xpathFor(target),
      label: friendlyLabel(tag, role),
      selectorChip: selectorChip(tag, classList),
    },
    box: {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      margin, border, padding, content,
    },
    text: {
      fontFamily: cs.fontFamily,
      fontSizePx: fontSize,
      lineHeightPx,
      fontWeight,
      letterSpacing: cs.letterSpacing,
      color: fg,
    },
    selection: {
      fg, bg,
      contrast: { ratio, verdict: verdict(ratio), isLarge },
    },
    matched,
    groupedDiff,
  };
}