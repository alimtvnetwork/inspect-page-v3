/**
 * P1 — Selector path. Source: spec/21-app/05-element-export.md.
 *
 * Walks ancestors up to <html>, emits `tag#id` (and stops) when the id is
 * unique, otherwise `tag:nth-of-type(N)` when same-tag siblings exist, else
 * the bare tag. Caps at SELECTOR_MAX_DEPTH and prepends "… > " on overflow.
 */
import { SELECTOR_MAX_DEPTH } from "@shared/constants";

export function selectorPath(target: Element, doc: Document = target.ownerDocument!): string {
  const segments: string[] = [];
  let el: Element | null = target;
  let truncated = false;

  while (el && el.nodeType === 1 && el !== doc.documentElement) {
    if (segments.length >= SELECTOR_MAX_DEPTH) {
      truncated = true;
      break;
    }
    segments.push(segmentFor(el, doc));
    if (el.id && doc.querySelectorAll(`#${cssEscape(el.id)}`).length === 1) {
      break;
    }
    el = el.parentElement;
  }

  if (el === doc.documentElement) segments.push("html");

  segments.reverse();
  return truncated ? `… > ${segments.join(" > ")}` : segments.join(" > ");
}

function segmentFor(el: Element, doc: Document): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && doc.querySelectorAll(`#${cssEscape(el.id)}`).length === 1) {
    return `${tag}#${el.id}`;
  }
  const siblings = el.parentElement
    ? Array.from(el.parentElement.children).filter((c) => c.tagName === el.tagName)
    : [];
  if (siblings.length > 1) {
    const idx = siblings.indexOf(el) + 1;
    return `${tag}:nth-of-type(${idx})`;
  }
  return tag;
}

function cssEscape(s: string): string {
  // Use native CSS.escape when available; fall back to a conservative encoder.
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  if (css?.escape) return css.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}
