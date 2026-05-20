/**
 * Shared types for Inspect Mode (phases A2 → A14).
 *
 * Kept narrow and serializable so the snapshot can be cached per-tab and
 * passed across the runtime boundary without loss.
 */

export interface PageInfo {
  url: string;
  title: string;
  origin: string;
  viewport: { w: number; h: number };
  documentSize: { w: number; h: number };
}

export type FontGeneric =
  | "serif" | "sans-serif" | "monospace" | "cursive" | "fantasy" | "system-ui" | "unknown";

export interface FontUsage {
  family: string;            // first family in the stack
  stack: string;             // raw font-family value
  generic: FontGeneric;
  weights: number[];         // sorted unique weights observed
  sizesPx: number[];         // sorted unique sizes observed (rounded)
  group: "heading" | "body";
  sampleCount: number;
}

export type ColorCategory =
  | "background" | "text" | "border" | "fill" | "stroke" | "gradient" | "shadow" | "other";

export interface ColorUsage {
  /** Lowercase hex (#rrggbb) or hex+alpha (#rrggbbaa); for gradients, the raw CSS value. */
  value: string;
  category: ColorCategory;
  /** Number of distinct elements where this color was observed. */
  instances: number;
  /** True when alpha < 1 or value is `transparent`. */
  transparent: boolean;
}

export interface CssStats {
  ruleCount: number;
  cssBytes: number;
  inlineStyleTagCount: number;
  unreachableSheetCount: number;
  externalSheetCount: number;
}

/** A small per-element computed snapshot used by the Inspector + Show Code drawer. */
export interface ComputedSample {
  selector: string;
  tagName: string;
  classList: string[];
  rect: { x: number; y: number; w: number; h: number };
  styles: Record<string, string>;
}

export interface TextNodeSample {
  selector: string;
  text: string;     // truncated to 80 chars
  fontFamily: string;
  fontSizePx: number;
  fontWeight: number;
  color: string;
  backgroundColor: string;
}

/**
 * Phase A4b — Text Typography group (CSS Peeper style).
 *
 * One card per unique (tag + family + size + weight + color) combination
 * observed in the page. Lets us render a per-tag list with an actual
 * sample of the element's text in its real typographic style.
 */
export interface TypographyGroup {
  /** Lowercase tag name, e.g. "p", "span", "h1", "a", "li", "button". */
  tag: string;
  /** Human label, e.g. "Paragraph", "Span", "Heading 1". */
  label: string;
  /** Number of matching elements on the page. */
  instances: number;
  fontFamily: string;
  fontStack: string;
  fontSizePx: number;
  fontWeight: number;
  /** `null` when `line-height: normal`. */
  lineHeightPx: number | null;
  letterSpacing: string;
  /** Normalized `#rrggbb` / `#rrggbbaa` — falls back to raw if unparseable. */
  color: string;
  /** First direct-text sample, trimmed to 80 chars. */
  sampleText: string;
  /** Short selector of the first matching element — used by Locate. */
  selectorPath: string;
}

export interface InspectSnapshot {
  pageInfo: PageInfo;
  fonts: FontUsage[];
  colors: ColorUsage[];
  cssStats: CssStats;
  computedSamples: ComputedSample[];
  textNodes: TextNodeSample[];
  /** Phase A4b — per-tag typography groups for the Text Typography section. */
  typography: TypographyGroup[];
  collectedAt: number;
}