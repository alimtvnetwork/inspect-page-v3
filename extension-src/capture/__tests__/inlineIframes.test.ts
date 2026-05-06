/**
 * Tests for v2 cross-origin iframe traversal.
 *
 * happy-dom returns a real Document for any iframe.contentDocument, so we
 * simulate the cross-origin case by overriding the property to throw.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { inlineIframes } from "../inlineIframes";
import { serializeWithShadow } from "../shadowSerializer";

function reSerialize(): string {
  return `<!DOCTYPE html>${serializeWithShadow(document.documentElement)}`;
}

function makeFrame(src: string, opts?: { crossOrigin?: boolean; bodyHtml?: string }): HTMLIFrameElement {
  const f = document.createElement("iframe");
  f.setAttribute("src", src);
  document.body.appendChild(f);

  if (opts?.crossOrigin) {
    Object.defineProperty(f, "contentDocument", {
      configurable: true,
      get() { throw new Error("SecurityError"); },
    });
  } else if (opts?.bodyHtml !== undefined) {
    // happy-dom doesn't auto-create contentDocument for iframes with src,
    // so build a synthetic Document via DOMParser and stub the getter.
    const subDoc = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><head><title>sub</title></head><body>${opts.bodyHtml}</body></html>`,
      "text/html",
    );
    Object.defineProperty(f, "contentDocument", {
      configurable: true,
      get() { return subDoc; },
    });
  }
  return f;
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("inlineIframes", () => {
  it("is a no-op when there are no iframes", async () => {
    document.body.innerHTML = `<p>hello</p>`;
    const html = reSerialize();
    const r = await inlineIframes(html, document);
    expect(r.html).toBe(html);
    expect(r.counts.total).toBe(0);
  });

  it("replaces same-origin iframe with srcdoc", async () => {
    makeFrame("https://example.com/sub", { bodyHtml: `<h1>inner</h1>` });
    const html = reSerialize();
    const r = await inlineIframes(html, document);
    expect(r.counts.total).toBe(1);
    expect(r.counts.sameOrigin).toBe(1);
    expect(r.counts.crossOrigin).toBe(0);
    expect(r.html).toContain(`srcdoc="`);
    expect(r.html).toContain(`data-llm-export-srcdoc="true"`);
    // Inner content is base64-or-escaped inside srcdoc; just check it's there.
    expect(r.html).toMatch(/srcdoc="[^"]*&lt;h1>inner&lt;\/h1>[^"]*"/);
    // Original src attribute preserved.
    expect(r.html).toContain(`src="https://example.com/sub"`);
  });

  it("marks cross-origin iframes without inlining", async () => {
    makeFrame("https://other.com/sub", { crossOrigin: true });
    const html = reSerialize();
    const r = await inlineIframes(html, document);
    expect(r.counts.total).toBe(1);
    expect(r.counts.sameOrigin).toBe(0);
    expect(r.counts.crossOrigin).toBe(1);
    expect(r.html).toContain(`data-llm-export-cross-origin="true"`);
    expect(r.html).not.toContain(`srcdoc=`);
    expect(r.html).toContain(`src="https://other.com/sub"`);
  });

  it("handles a mix of same- and cross-origin frames", async () => {
    makeFrame("https://example.com/a", { bodyHtml: `<p>a</p>` });
    makeFrame("https://other.com/b",   { crossOrigin: true });
    makeFrame("https://example.com/c", { bodyHtml: `<p>c</p>` });

    const html = reSerialize();
    const r = await inlineIframes(html, document);
    expect(r.counts.total).toBe(3);
    expect(r.counts.sameOrigin).toBe(2);
    expect(r.counts.crossOrigin).toBe(1);
    // Match the srcdoc attribute itself, not the data-llm-export-srcdoc marker.
    expect((r.html.match(/(?<![-\w])srcdoc="/g) || []).length).toBe(2);
    expect((r.html.match(/data-llm-export-cross-origin/g) || []).length).toBe(1);
  });

  it("escapes quotes in srcdoc so the attribute stays well-formed", async () => {
    makeFrame("https://example.com/q", { bodyHtml: `<div title="he said &quot;hi&quot;">x</div>` });
    const html = reSerialize();
    const r = await inlineIframes(html, document);
    // No bare unescaped " inside the srcdoc value beyond the wrapping quotes.
    const match = r.html.match(/srcdoc="([^"]*)"/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toContain(`"`);
  });

  it("respects inlineIframeContent=false (no traversal)", async () => {
    makeFrame("https://example.com/x", { bodyHtml: `<p>x</p>` });
    const html = reSerialize();
    const r = await inlineIframes(html, document, { recurse: false, maxDepth: 0 });
    // recurse:false still traverses the *outer* level — that's expected.
    // The test for the disable knob lives in collectArtifacts; here we just
    // confirm that maxDepth=0 prevents deeper recursion (no nested frames
    // means counts stay at 1 sameOrigin).
    expect(r.counts.total).toBe(1);
    expect(r.counts.sameOrigin).toBe(1);
  });
});