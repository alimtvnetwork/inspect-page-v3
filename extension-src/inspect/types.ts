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

export interface InspectSnapshot {
  pageInfo: PageInfo;
  fonts: FontUsage[];
  colors: ColorUsage[];
  cssStats: CssStats;
  computedSamples: ComputedSample[];
  textNodes: TextNodeSample[];
  collectedAt: number;
}