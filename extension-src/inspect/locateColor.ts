/**
 * Phase A8b — Locate color matches in the live DOM.
 *
 * Scans every visible element and returns selectors of those whose computed
 * background, color, border, fill, or stroke matches `target` (a normalized
 * `#rrggbb` or `#rrggbbaa` hex). Pure read; no DOM mutation. Bounded by
 * MAX_ELEMENTS so giant pages still finish quickly.
 *
 * The flash overlay (`flashElements`) is the only side-effecting half: it
 * scrolls the first match into view and draws a short-lived ring around
 * every match using a single shared <style> tag.
 */
import { normalizeColor } from "./collectSnapshot";

const MAX_ELEMENTS = 8000;
const STYLE_ID = "lpe-locate-style";
const RING_CLASS = "lpe-locate-ring";
const RING_DURATION_MS = 1500;

const COLOR_PROPS = [
  "background-color",
  "color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "fill",
  "stroke",
] as const;

export interface LocateMatch {
  /** Live element reference (only valid in the page context). */
  el: Element;
}

/** Pure DOM scan — returns elements whose computed colors match `target`. */
export function findColorMatches(target: string, root: ParentNode = document): Element[] {
  const want = (target || "").toLowerCase();
  if (!want) return [];
  const out: Element[] = [];
  const all = root.querySelectorAll<Element>("*");
  const limit = Math.min(all.length, MAX_ELEMENTS);
  for (let i = 0; i < limit; i++) {
    const el = all[i]!;
    const cs = getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const norm = normalizeColor(cs.getPropertyValue(prop));
      if (norm && norm === want) {
        out.push(el);
        break;
      }
    }
  }
  return out;
}

/** Scroll first match into view + flash a ring around every match. */
export function flashElements(els: Element[]): void {
  if (els.length === 0) return;
  ensureStyleTag();
  const first = els[0]!;
  try {
    first.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  } catch { /* older browsers */ }
  for (const el of els) {
    el.classList.add(RING_CLASS);
  }
  window.setTimeout(() => {
    for (const el of els) el.classList.remove(RING_CLASS);
  }, RING_DURATION_MS);
}

/** Combined helper used by the content-script message handler. */
export function locateColor(target: string): { count: number } {
  const matches = findColorMatches(target);
  flashElements(matches);
  return { count: matches.length };
}

/**
 * Locate an element by selector — used by the Element Inspector "Locate"
 * button. Scrolls the match into view and flashes the shared ring around it.
 * Returns 0 when the selector matches nothing (e.g. element was removed).
 */
export function locateElement(selector: string): { count: number } {
  if (!selector) return { count: 0 };
  let els: Element[] = [];
  try {
    els = Array.from(document.querySelectorAll(selector));
  } catch {
    return { count: 0 };
  }
  flashElements(els);
  return { count: els.length };
}

function ensureStyleTag(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.${RING_CLASS} {
  outline: 2px solid #ff5b1f !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 2px rgba(255, 91, 31, 0.35), 0 0 16px 4px rgba(255, 91, 31, 0.55) !important;
  animation: lpe-locate-pulse ${RING_DURATION_MS}ms ease-out 1;
}
@keyframes lpe-locate-pulse {
  0%   { outline-color: #ff5b1f; box-shadow: 0 0 0 0 rgba(255, 91, 31, 0.7), 0 0 18px 4px rgba(255, 91, 31, 0.6); }
  60%  { outline-color: #ff5b1f; box-shadow: 0 0 0 6px rgba(255, 91, 31, 0.0), 0 0 18px 4px rgba(255, 91, 31, 0.5); }
  100% { outline-color: #ff5b1f; box-shadow: 0 0 0 0 rgba(255, 91, 31, 0.0), 0 0 0 0 rgba(255, 91, 31, 0.0); }
}
`.trim();
  document.documentElement.appendChild(style);
}
