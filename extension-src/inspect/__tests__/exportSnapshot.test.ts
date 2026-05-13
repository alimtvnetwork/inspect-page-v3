import { describe, it, expect } from "vitest";
import {
  csvEscape, toCsv, colorsToCsv, fontsToCsv,
  toJson, toMarkdown, safeBaseName, mimeFor,
} from "../exportSnapshot";
import type { InspectSnapshot } from "../types";

const snapshot: InspectSnapshot = {
  pageInfo: {
    url: "https://www.Example.com/path?q=1",
    title: "Hi",
    origin: "https://example.com",
    viewport: { w: 1280, h: 800 },
    documentSize: { w: 1280, h: 4000 },
  },
  fonts: [
    { family: "Inter", stack: '"Inter", sans-serif', generic: "sans-serif",
      weights: [400, 700], sizesPx: [14, 16], group: "body", sampleCount: 12 },
  ],
  colors: [
    { value: "#ff0000", category: "text", instances: 5, transparent: false },
    { value: 'linear-gradient(45deg, "red", blue)', category: "gradient", instances: 1, transparent: false },
  ],
  cssStats: { ruleCount: 100, cssBytes: 2048, inlineStyleTagCount: 1, unreachableSheetCount: 0, externalSheetCount: 2 },
  computedSamples: [],
  textNodes: [],
  collectedAt: Date.UTC(2026, 4, 13, 10, 0, 0),
};

describe("csvEscape", () => {
  it("leaves plain values unchanged", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape(42)).toBe("42");
  });
  it("quotes commas, quotes, and newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("toCsv", () => {
  it("emits header even when rows are empty", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\n");
  });
  it("escapes cell values", () => {
    const out = toCsv(["v"], [['a,b'], ['"q"']]);
    expect(out).toBe('v\n"a,b"\n"""q"""\n');
  });
});

describe("colorsToCsv", () => {
  it("escapes gradient values that contain commas/quotes", () => {
    const csv = colorsToCsv(snapshot.colors);
    expect(csv.split("\n")[0]).toBe("value,category,instances,transparent");
    expect(csv).toContain('"linear-gradient(45deg, ""red"", blue)"');
  });
});

describe("toJson", () => {
  it("emits stable, parseable JSON", () => {
    const text = toJson(snapshot);
    const parsed = JSON.parse(text);
    expect(parsed.pageInfo.url).toBe(snapshot.pageInfo.url);
    expect(parsed.cssStats.ruleCount).toBe(100);
  });
});

describe("toMarkdown", () => {
  it("includes URL, css stats and a colors table", () => {
    const md = toMarkdown(snapshot);
    expect(md).toContain("# Inspect Page report");
    expect(md).toContain("https://www.Example.com/path?q=1");
    expect(md).toContain("| `#ff0000` | text | 5 |");
  });
});

describe("fontsToCsv", () => {
  it("joins weights and sizes with pipes", () => {
    const csv = fontsToCsv(snapshot.fonts);
    expect(csv).toContain("400|700");
    expect(csv).toContain("14|16");
  });
});

describe("safeBaseName", () => {
  it("derives a slug from hostname (strips www., lowercases) and dates it", () => {
    expect(safeBaseName(snapshot)).toBe("inspect-page-example-com-2026-05-13");
  });
  it("falls back when URL is invalid", () => {
    const bad = { ...snapshot, pageInfo: { ...snapshot.pageInfo, url: "" } };
    expect(safeBaseName(bad)).toMatch(/^inspect-page-snapshot-/);
  });
});

describe("mimeFor", () => {
  it("returns proper mime + ext for each kind", () => {
    expect(mimeFor("csv").ext).toBe("csv");
    expect(mimeFor("json").mime).toContain("application/json");
    expect(mimeFor("md").ext).toBe("md");
  });
});