/**
 * XPath builder for the Pick Element inspector.
 *
 * Emits an absolute XPath like `/html/body/div[2]/button[1]`. When the
 * element has a unique `id`, returns a short `//*[@id="..."]` form instead.
 */
export function xpathFor(target: Element, doc: Document = target.ownerDocument!): string {
  if (target.id) {
    const matches = doc.querySelectorAll(`[id="${cssEscape(target.id)}"]`);
    if (matches.length === 1) return `//*[@id="${target.id}"]`;
  }
  const parts: string[] = [];
  let el: Element | null = target;
  while (el && el.nodeType === 1 && el !== doc.documentElement) {
    const tag = el.tagName.toLowerCase();
    const siblings = el.parentElement
      ? Array.from(el.parentElement.children).filter((c) => c.tagName === el.tagName)
      : [];
    const idx = siblings.length > 1 ? siblings.indexOf(el) + 1 : 0;
    parts.unshift(idx > 0 ? `${tag}[${idx}]` : tag);
    el = el.parentElement;
  }
  parts.unshift("html");
  return `/${parts.join("/")}`;
}

function cssEscape(s: string): string {
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS;
  if (css?.escape) return css.escape(s);
  return s.replace(/["\\]/g, (ch) => `\\${ch}`);
}