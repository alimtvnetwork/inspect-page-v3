/**
 * Phase v2.7.5 — Color → Selector index.
 *
 * Walks the captured `ComputedSample[]` and builds a map of normalized hex
 * color → list of {selector, property} bindings. Used by the Tokens tab to
 * answer "which selectors use this color?" and by the exporters to emit
 * per-selector CSS blocks.
 *
 * Pure — does not touch the DOM. Caps each color at MAX_BINDINGS to keep
 * exports finite on giant pages.
 */
import type { ColorSelectorBinding, ComputedSample } from "./types";
import { normalizeColor } from "./collectSnapshot";

export const MAX_BINDINGS_PER_COLOR = 50;

/** Properties on `ComputedSample.styles` that hold (or contain) colors. */
const DIRECT_COLOR_KEYS: Array<[styleKey: string, cssProp: string]> = [
  ["color", "color"],
  ["backgroundColor", "background-color"],
];

/** Extract every `rgb(...)` / `rgba(...)` substring from a shorthand value. */
function extractRgbInShorthand(value: string): string[] {
  if (!value) return [];
  const out: string[] = [];
  const re = /rgba?\([^)]+\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) out.push(m[0]);
  return out;
}

export function buildColorSelectorIndex(
  samples: readonly ComputedSample[],
): Map<string, ColorSelectorBinding[]> {
  const map = new Map<string, ColorSelectorBinding[]>();

  const push = (hex: string, binding: ColorSelectorBinding): void => {
    let list = map.get(hex);
    if (!list) { list = []; map.set(hex, list); }
    if (list.length >= MAX_BINDINGS_PER_COLOR) return;
    // De-dup (selector, property) pairs.
    if (list.some((b) => b.selector === binding.selector && b.property === binding.property)) return;
    list.push(binding);
  };

  for (const s of samples) {
    if (!s.selector) continue;

    for (const [key, prop] of DIRECT_COLOR_KEYS) {
      const raw = s.styles[key];
      const hex = normalizeColor(raw);
      if (hex) push(hex, { selector: s.selector, property: prop });
    }

    // Border shorthand: "1px solid rgb(36, 48, 86)" — extract embedded color(s).
    const border = s.styles.border;
    if (border) {
      for (const chunk of extractRgbInShorthand(border)) {
        const hex = normalizeColor(chunk);
        if (hex) push(hex, { selector: s.selector, property: "border-color" });
      }
    }
  }

  return map;
}

/**
 * Inverse view: selector → list of (hex, property) entries. Convenient for the
 * per-selector CSS exporter and the "edit per-selector custom CSS" UI.
 */
export interface SelectorBinding { hex: string; property: string }
export function invertSelectorIndex(
  index: Map<string, ColorSelectorBinding[]>,
): Map<string, SelectorBinding[]> {
  const out = new Map<string, SelectorBinding[]>();
  for (const [hex, bindings] of index) {
    for (const b of bindings) {
      let list = out.get(b.selector);
      if (!list) { list = []; out.set(b.selector, list); }
      if (list.some((e) => e.hex === hex && e.property === b.property)) continue;
      list.push({ hex, property: b.property });
    }
  }
  return out;
}