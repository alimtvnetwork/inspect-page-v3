/**
 * Detects DOM nodes injected by other browser extensions (or dev overlays)
 * so we can exclude them from Inspect Page captures, snapshots, and exports.
 *
 * Heuristics (intentionally conservative — must not strip real page content):
 *  - Inspect Page's own hosts (`#inspect-page-*-host`).
 *  - Direct children of <html> or <body> that are custom elements
 *    (tagName contains "-" — common pattern for extension overlays).
 *  - Direct children of <html> or <body> with an attached open shadowRoot
 *    AND position:fixed/sticky (extension widgets, debug HUDs, etc.).
 *  - Direct children of <html> or <body> with position:fixed AND a very
 *    high z-index (>= 2147480000) — the "always on top" extension pattern.
 */

export const OVERLAY_HOST_SELECTOR =
  "#inspect-page-panel-host,#inspect-page-picker-host,[id^='inspect-page-'][id$='-host']";

const HIGH_Z = 2147480000;

export function isInjectedOverlay(el: Element, win: Window = window): boolean {
  if (!el || el.nodeType !== 1) return false;
  // Inspect Page own hosts
  if ((el as HTMLElement).matches?.(OVERLAY_HOST_SELECTOR)) return true;

  const parent = el.parentElement;
  const isTopLevel = parent === el.ownerDocument?.body || parent === el.ownerDocument?.documentElement;
  if (!isTopLevel) return false;

  const tag = el.tagName;
  // Custom elements injected at the document root are almost always extension UI.
  if (tag.includes("-")) return true;

  let cs: CSSStyleDeclaration | null = null;
  try { cs = win.getComputedStyle(el); } catch { cs = null; }
  const pos = cs?.position ?? "";
  const fixedish = pos === "fixed" || pos === "sticky";

  if (fixedish && (el as HTMLElement).shadowRoot) return true;
  if (fixedish) {
    const z = Number(cs?.zIndex);
    if (Number.isFinite(z) && z >= HIGH_Z) return true;
  }
  return false;
}

export function collectInjectedOverlays(doc: Document = document, win: Window = window): HTMLElement[] {
  const out: HTMLElement[] = [];
  const roots: Element[] = [];
  if (doc.documentElement) roots.push(...Array.from(doc.documentElement.children));
  if (doc.body) roots.push(...Array.from(doc.body.children));
  const seen = new Set<Element>();
  for (const el of roots) {
    if (seen.has(el)) continue;
    seen.add(el);
    if (isInjectedOverlay(el, win)) out.push(el as HTMLElement);
  }
  return out;
}
