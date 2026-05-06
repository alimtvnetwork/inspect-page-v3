/**
 * Tests for the v2 shadow-DOM-aware serializer.
 * Environment: jsdom (configured via environmentMatchGlobs).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { serializeWithShadow, countOpenShadowRoots } from "../shadowSerializer";

function el(html: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  return wrap.firstElementChild as HTMLElement;
}

describe("serializeWithShadow", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("serializes plain elements with attributes and text", () => {
    const node = el(`<div class="a" data-x="1">hi <span>world</span></div>`);
    expect(serializeWithShadow(node)).toBe(
      `<div class="a" data-x="1">hi <span>world</span></div>`,
    );
  });

  it("escapes attribute and text content", () => {
    const node = el(`<p title='a&amp;"b'>1 &lt; 2</p>`);
    const out = serializeWithShadow(node);
    expect(out).toContain(`title="a&amp;&quot;b"`);
    expect(out).toContain(`1 &lt; 2`);
  });

  it("emits void elements without a closing tag", () => {
    const node = el(`<div><br><img src="x.png"></div>`);
    expect(serializeWithShadow(node)).toBe(`<div><br><img src="x.png"></div>`);
  });

  it("expands open shadow roots into declarative templates", () => {
    const host = document.createElement("my-card");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>:host{color:red}</style><h1>Hello</h1>`;
    const span = document.createElement("span");
    span.textContent = "slotted";
    host.appendChild(span);

    const out = serializeWithShadow(host);
    expect(out.startsWith(`<my-card>`)).toBe(true);
    expect(out).toContain(`<template shadowrootmode="open">`);
    expect(out).toContain(`<style>:host{color:red}</style>`);
    expect(out).toContain(`<h1>Hello</h1>`);
    expect(out).toContain(`<span>slotted</span>`);
    expect(out.endsWith(`</my-card>`)).toBe(true);
  });

  it("ignores shadow roots when expandShadowRoots=false", () => {
    const host = document.createElement("my-card");
    document.body.appendChild(host);
    host.attachShadow({ mode: "open" }).innerHTML = `<h1>Inside</h1>`;

    const out = serializeWithShadow(host, { expandShadowRoots: false });
    expect(out).not.toContain("Inside");
    expect(out).not.toContain("template");
  });

  it("recurses into nested shadow roots", () => {
    const outer = document.createElement("outer-el");
    document.body.appendChild(outer);
    const oRoot = outer.attachShadow({ mode: "open" });
    const inner = document.createElement("inner-el");
    oRoot.appendChild(inner);
    inner.attachShadow({ mode: "open" }).innerHTML = `<p>deep</p>`;

    const out = serializeWithShadow(outer);
    const tplCount = (out.match(/shadowrootmode="open"/g) || []).length;
    expect(tplCount).toBe(2);
    expect(out).toContain("<p>deep</p>");
  });

  it("redacts password inputs inline", () => {
    const node = el(`<form><input type="password" value="secret" name="p"></form>`);
    const out = serializeWithShadow(node, { redactPasswordFields: true });
    expect(out).not.toContain("secret");
    expect(out).toContain(`value=""`);
    expect(out).toContain(`data-redacted="true"`);
  });

  it("preserves <template> .content children", () => {
    const node = el(`<div><template id="t"><span>x</span></template></div>`);
    const out = serializeWithShadow(node);
    expect(out).toContain(`<template id="t"><span>x</span></template>`);
  });

  it("does not HTML-escape script/style bodies", () => {
    const node = el(`<div></div>`);
    const s = document.createElement("script");
    s.textContent = `if (a < b && c > d) {}`;
    node.appendChild(s);
    const out = serializeWithShadow(node);
    expect(out).toContain(`if (a < b && c > d) {}`);
  });

  it("inlines adoptedStyleSheets from an open shadow root", () => {
    if (typeof CSSStyleSheet === "undefined" || !("replaceSync" in CSSStyleSheet.prototype)) {
      // Environment doesn't support constructed stylesheets — skip silently.
      return;
    }
    const host = document.createElement("lit-card");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`:host{display:block;color:rebeccapurple}`);
    (root as ShadowRoot & { adoptedStyleSheets: CSSStyleSheet[] }).adoptedStyleSheets = [sheet];
    root.innerHTML = `<p>hi</p>`;

    const out = serializeWithShadow(host);
    expect(out).toContain(`data-adopted-stylesheet="true"`);
    expect(out).toContain(`rebeccapurple`);
    // Adopted sheet appears INSIDE the declarative template, before children.
    const tplIdx = out.indexOf(`<template shadowrootmode="open">`);
    const styleIdx = out.indexOf(`data-adopted-stylesheet`);
    const pIdx = out.indexOf(`<p>hi</p>`);
    expect(tplIdx).toBeGreaterThan(-1);
    expect(styleIdx).toBeGreaterThan(tplIdx);
    expect(pIdx).toBeGreaterThan(styleIdx);
  });

  it("skips adoptedStyleSheets when captureAdoptedStyleSheets=false", () => {
    if (typeof CSSStyleSheet === "undefined" || !("replaceSync" in CSSStyleSheet.prototype)) return;
    const host = document.createElement("lit-card");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`p{color:red}`);
    (root as ShadowRoot & { adoptedStyleSheets: CSSStyleSheet[] }).adoptedStyleSheets = [sheet];
    root.innerHTML = `<p>x</p>`;

    const out = serializeWithShadow(host, { captureAdoptedStyleSheets: false });
    expect(out).not.toContain(`data-adopted-stylesheet`);
    expect(out).not.toContain(`color:red`);
  });
});

describe("countOpenShadowRoots", () => {
  it("counts only open roots, recursively", () => {
    const host = document.createElement("a-el");
    document.body.appendChild(host);
    const r = host.attachShadow({ mode: "open" });
    const child = document.createElement("b-el");
    r.appendChild(child);
    child.attachShadow({ mode: "open" });

    const closedHost = document.createElement("c-el");
    host.appendChild(closedHost);
    closedHost.attachShadow({ mode: "closed" });

    expect(countOpenShadowRoots(host)).toBe(2);
  });
});
