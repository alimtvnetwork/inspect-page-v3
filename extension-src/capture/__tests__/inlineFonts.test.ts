/**
 * Tests for v2 font binary bundling.
 */
import { describe, it, expect } from "vitest";
import { inlineFonts } from "../inlineFonts";

function makeFetcher(
  table: Record<string, { body: ArrayBuffer; status?: number; contentType?: string }>,
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const entry = table[url];
    if (!entry) {
      return new Response(null, { status: 404 }) as unknown as Response;
    }
    const headers = new Headers();
    if (entry.contentType) headers.set("content-type", entry.contentType);
    return {
      ok: (entry.status ?? 200) >= 200 && (entry.status ?? 200) < 300,
      status: entry.status ?? 200,
      headers,
      arrayBuffer: async () => entry.body,
      text: async () => "",
    } as unknown as Response;
  }) as typeof fetch;
}

function buf(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

const BASE = "https://example.com/page";

describe("inlineFonts", () => {
  it("returns css unchanged when there are no @font-face blocks", async () => {
    const css = `body { color: red; } a { background: url(/x.png); }`;
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher: makeFetcher({}) });
    expect(r.css).toBe(css);
    expect(r.counts.candidates).toBe(0);
  });

  it("inlines a woff2 font as a base64 data URI", async () => {
    const css = `@font-face { font-family: 'X'; src: url("/fonts/x.woff2") format('woff2'); }`;
    const fetcher = makeFetcher({
      "https://example.com/fonts/x.woff2": {
        body: buf([0x77, 0x4f, 0x46, 0x32]),
        contentType: "font/woff2",
      },
    });
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher });
    expect(r.css).toContain("data:font/woff2;base64,");
    expect(r.css).toContain("d09GMg=="); // base64 of bytes above
    expect(r.css).not.toContain("/fonts/x.woff2");
    expect(r.counts.inlined).toBe(1);
    expect(r.counts.bytesInlined).toBe(4);
    expect(r.counts.failed).toBe(0);
  });

  it("rewrites multiple url() entries inside one src list", async () => {
    const css = `@font-face {
      font-family: 'Y';
      src: url("/y.woff2") format("woff2"),
           url("/y.woff")  format("woff");
    }`;
    const fetcher = makeFetcher({
      "https://example.com/y.woff2": { body: buf([1, 2, 3]) },
      "https://example.com/y.woff":  { body: buf([4, 5, 6]) },
    });
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher });
    expect(r.css).toContain("data:font/woff2;base64,");
    expect(r.css).toContain("data:font/woff;base64,");
    expect(r.counts.inlined).toBe(2);
  });

  it("skips data: URLs", async () => {
    const css = `@font-face { font-family: 'Z'; src: url(data:font/woff2;base64,AAAA); }`;
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher: makeFetcher({}) });
    expect(r.css).toBe(css);
    expect(r.counts.skippedAlreadyData).toBe(1);
    expect(r.counts.inlined).toBe(0);
  });

  it("respects per-font size cap", async () => {
    const css = `@font-face { font-family: 'Big'; src: url("/big.woff2"); }`;
    const big = new Uint8Array(2000).fill(0xab).buffer;
    const fetcher = makeFetcher({ "https://example.com/big.woff2": { body: big } });
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher, maxPerFontBytes: 1024 });
    expect(r.counts.skippedTooLarge).toBe(1);
    expect(r.counts.inlined).toBe(0);
    expect(r.css).toContain("/big.woff2"); // original preserved
  });

  it("respects total budget", async () => {
    const css = `
      @font-face { font-family: 'A'; src: url("/a.woff2"); }
      @font-face { font-family: 'B'; src: url("/b.woff2"); }
    `;
    const k600 = new Uint8Array(600).buffer;
    const fetcher = makeFetcher({
      "https://example.com/a.woff2": { body: k600 },
      "https://example.com/b.woff2": { body: k600 },
    });
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher, maxTotalBytes: 1000 });
    expect(r.counts.inlined).toBe(1);
    expect(r.counts.skippedBudget).toBe(1);
  });

  it("counts failures and preserves original url() on fetch error", async () => {
    const css = `@font-face { font-family: 'F'; src: url("/missing.woff2"); }`;
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher: makeFetcher({}) });
    expect(r.counts.failed).toBe(1);
    expect(r.counts.inlined).toBe(0);
    expect(r.css).toContain("/missing.woff2");
  });

  it("deduplicates identical URLs across @font-face blocks", async () => {
    const css = `
      @font-face { font-family: 'A'; src: url("/shared.woff2"); }
      @font-face { font-family: 'B'; src: url("/shared.woff2"); }
    `;
    let fetchCount = 0;
    const fetcher: typeof fetch = (async () => {
      fetchCount += 1;
      return {
        ok: true, status: 200,
        headers: new Headers({ "content-type": "font/woff2" }),
        arrayBuffer: async () => buf([9, 9]),
        text: async () => "",
      } as unknown as Response;
    }) as typeof fetch;
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher });
    expect(fetchCount).toBe(1);
    expect(r.counts.inlined).toBe(1);
    expect((r.css.match(/data:font\/woff2;base64,/g) || []).length).toBe(2);
  });

  it("falls back to extension-derived MIME when server omits content-type", async () => {
    const css = `@font-face { font-family: 'M'; src: url("/m.ttf"); }`;
    const fetcher = makeFetcher({
      "https://example.com/m.ttf": { body: buf([1]) }, // no contentType
    });
    const r = await inlineFonts(css, { baseUrl: BASE, fetcher });
    expect(r.css).toContain("data:font/ttf;base64,");
  });
});