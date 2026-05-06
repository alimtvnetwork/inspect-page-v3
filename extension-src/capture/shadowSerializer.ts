/**
 * P1 — Shadow-DOM-aware HTML serializer (v2 / spec/19-edge-cases.md).
 *
 * Native cloneNode / outerHTML drops shadow-root content, which makes
 * exports of any web-component-driven page (YouTube, Salesforce, GitHub
 * primer-elements, etc.) lose their visible markup. This walker:
 *
 *   - clones each element's attributes + children
 *   - when an element has an open shadowRoot, serializes its assigned/
 *     shadow children inline as a <template shadowrootmode="open"> child,
 *     matching the Declarative Shadow DOM spec so the output re-hydrates
 *     in any modern browser
 *   - leaves closed shadow roots untouched (not accessible by design)
 *   - never mutates the live DOM
 */

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function escapeAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeText(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serializeAttrs(el: Element): string {
  let out = "";
  for (const a of Array.from(el.attributes)) {
    out += ` ${a.name}="${escapeAttr(a.value)}"`;
  }
  return out;
}

export interface ShadowSerializeOptions {
  /** When true, redact <input type="password"> values inline. */
  redactPasswordFields?: boolean;
  /** When true, traverse open shadow roots (default true). */
  expandShadowRoots?: boolean;
  /**
   * When true (default), capture `adoptedStyleSheets` attached to the
   * document or any open shadow root and inline them as <style> tags.
   * Required to faithfully render Lit / FAST / Spectrum / Ionic / any
   * web component that ships CSS via Constructed Stylesheets.
   */
  captureAdoptedStyleSheets?: boolean;
}

/**
 * Serialize a node tree to HTML, expanding open shadow roots into
 * declarative <template shadowrootmode="open"> blocks.
 */
export function serializeWithShadow(
  node: Node,
  opts: ShadowSerializeOptions = {},
): string {
  const expand = opts.expandShadowRoots !== false;
  const redact = !!opts.redactPasswordFields;
  const captureAdopted = opts.captureAdoptedStyleSheets !== false;

  /**
   * Serialize a CSSStyleSheet (constructed or otherwise) into a CSS string.
   * Falls back to "" if the sheet is cross-origin and `cssRules` access throws.
   */
  const sheetToCss = (sheet: CSSStyleSheet): string => {
    try {
      const rules = sheet.cssRules;
      let css = "";
      for (let i = 0; i < rules.length; i += 1) css += rules[i].cssText;
      return css;
    } catch {
      return "";
    }
  };

  const adoptedToStyleTag = (root: { adoptedStyleSheets?: readonly CSSStyleSheet[] }): string => {
    if (!captureAdopted) return "";
    const sheets = root.adoptedStyleSheets;
    if (!sheets || sheets.length === 0) return "";
    let css = "";
    for (const s of sheets) css += sheetToCss(s);
    if (!css) return "";
    return `<style data-adopted-stylesheet="true">${css}</style>`;
  };

  const walk = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) {
      return escapeText((n as Text).data);
    }
    if (n.nodeType === Node.COMMENT_NODE) {
      return `<!--${(n as Comment).data}-->`;
    }
    if (n.nodeType === Node.CDATA_SECTION_NODE) {
      return `<![CDATA[${(n as CDATASection).data}]]>`;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return "";

    const el = n as Element;
    const tag = el.tagName.toLowerCase();

    // Redact passwords inline.
    if (
      redact &&
      tag === "input" &&
      (el.getAttribute("type") || "").toLowerCase() === "password"
    ) {
      const cloned = el.cloneNode(false) as Element;
      cloned.setAttribute("value", "");
      cloned.setAttribute("data-redacted", "true");
      return `<input${serializeAttrs(cloned)}>`;
    }

    if (VOID_ELEMENTS.has(tag)) {
      return `<${tag}${serializeAttrs(el)}>`;
    }

    // <template> children live in .content, not childNodes.
    if (tag === "template") {
      const tpl = el as HTMLTemplateElement;
      let inner = "";
      for (const c of Array.from(tpl.content.childNodes)) inner += walk(c);
      return `<template${serializeAttrs(el)}>${inner}</template>`;
    }

    // Preserve raw text in script/style without HTML-escaping.
    if (tag === "script" || tag === "style") {
      return `<${tag}${serializeAttrs(el)}>${el.textContent ?? ""}</${tag}>`;
    }

    let inner = "";

    // Open shadow root → declarative shadow DOM template.
    const shadow = expand ? (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot : null;
    if (shadow && shadow.mode === "open") {
      let shadowInner = "";
      // Inline any constructed stylesheets first so they apply before children.
      shadowInner += adoptedToStyleTag(shadow as unknown as { adoptedStyleSheets?: readonly CSSStyleSheet[] });
      for (const c of Array.from(shadow.childNodes)) shadowInner += walk(c);
      inner += `<template shadowrootmode="open">${shadowInner}</template>`;
    }

    for (const c of Array.from(el.childNodes)) inner += walk(c);

    return `<${tag}${serializeAttrs(el)}>${inner}</${tag}>`;
  };

  // If serializing a Document or <html> root, prepend the document's own
  // adoptedStyleSheets into <head> as a <style> tag.
  let out = walk(node);
  if (captureAdopted && node.nodeType === Node.ELEMENT_NODE) {
    const docRoot = (node as Element).ownerDocument?.documentElement;
    const isHtmlRoot = docRoot === node;
    if (isHtmlRoot) {
      const docAdopted = adoptedToStyleTag(
        (node as Element).ownerDocument as unknown as { adoptedStyleSheets?: readonly CSSStyleSheet[] },
      );
      if (docAdopted) {
        const headOpen = out.match(/<head(\s[^>]*)?>/i);
        if (headOpen) {
          const i = (headOpen.index ?? 0) + headOpen[0].length;
          out = out.slice(0, i) + docAdopted + out.slice(i);
        } else {
          out = out.replace(
            /<html(\s[^>]*)?>/i,
            (m) => `${m}<head>${docAdopted}</head>`,
          );
        }
      }
    }
  }
  return out;
}

/** Count open shadow roots in a subtree. Useful for telemetry / tests. */
export function countOpenShadowRoots(root: Element): number {
  let n = 0;
  const walk = (el: Element) => {
    const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (sr && sr.mode === "open") {
      n += 1;
      for (const c of Array.from(sr.children)) walk(c);
    }
    for (const c of Array.from(el.children)) walk(c);
  };
  walk(root);
  return n;
}