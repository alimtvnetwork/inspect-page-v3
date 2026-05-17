import { describe, it, expect, beforeEach } from "vitest";
import {
  collectSnapshot,
  getOrCollectSnapshot,
  clearSnapshotCache,
  normalizeColor,
  primaryFamily,
  genericForFamily,
} from "../collectSnapshot";

describe("normalizeColor", () => {
  it("normalizes rgb to lowercase hex", () => {
    expect(normalizeColor("rgb(255, 0, 17)")).toBe("#ff0011");
  });
  it("preserves alpha when < 1", () => {
    expect(normalizeColor("rgba(0, 0, 0, 0.5)")).toBe("#00000080");
  });
  it("returns null for transparent / none / empty", () => {
    expect(normalizeColor("transparent")).toBeNull();
    expect(normalizeColor("none")).toBeNull();
    expect(normalizeColor("")).toBeNull();
    expect(normalizeColor(null)).toBeNull();
  });
  it("expands short hex", () => {
    expect(normalizeColor("#abc")).toBe("#aabbcc");
  });
});

describe("font helpers", () => {
  it("strips quotes from primary family", () => {
    expect(primaryFamily('"Inter", sans-serif')).toBe("Inter");
  });
  it("classifies generics", () => {
    expect(genericForFamily("Georgia, serif")).toBe("serif");
    expect(genericForFamily("Inter, sans-serif")).toBe("sans-serif");
    expect(genericForFamily('"JetBrains Mono", monospace')).toBe("monospace");
  });
});

describe("collectSnapshot", () => {
  beforeEach(() => {
    clearSnapshotCache();
    document.body.innerHTML = `
      <h1 style="color: rgb(0,0,0); font-family: 'Inter', sans-serif; font-size: 32px; font-weight: 700;">Hello</h1>
      <p style="color: rgb(51,51,51); font-family: 'Inter', sans-serif; font-size: 16px;">Body text here</p>
      <div style="background-color: rgb(255,0,0); border: 1px solid rgb(0,0,255);"></div>
    `;
  });

  it("returns the expected shape", () => {
    const snap = collectSnapshot();
    expect(snap.pageInfo).toBeDefined();
    expect(Array.isArray(snap.fonts)).toBe(true);
    expect(Array.isArray(snap.colors)).toBe(true);
    expect(snap.cssStats).toBeDefined();
    expect(snap.collectedAt).toBeGreaterThan(0);
  });

  it("groups headings vs body fonts", () => {
    const snap = collectSnapshot();
    const groups = new Set(snap.fonts.map((f) => f.group));
    expect(groups.has("heading")).toBe(true);
    expect(groups.has("body")).toBe(true);
  });

  it("dedupes colors and tags categories", () => {
    const snap = collectSnapshot();
    const cats = new Set(snap.colors.map((c) => c.category));
    expect(cats.has("text")).toBe(true);
    expect(cats.has("background")).toBe(true);
    expect(cats.has("border")).toBe(true);
  });

  it("caches per key via getOrCollectSnapshot", () => {
    const a = getOrCollectSnapshot("k1");
    const b = getOrCollectSnapshot("k1");
    expect(a).toBe(b);
  });

  it("excludes injected foreign-extension overlays from samples", () => {
    document.body.innerHTML = `
      <h1 style="color: rgb(0,0,0); font-family: 'Inter', sans-serif; font-size: 32px;">Hello</h1>
      <p style="color: rgb(51,51,51); font-family: 'Inter', sans-serif; font-size: 16px;">Body</p>
    `;
    // Simulate another extension injecting a custom-element overlay at body root.
    const overlay = document.createElement("dev-overlay-widget");
    overlay.innerHTML = `<span style="color: rgb(255,0,128); font-family: 'Comic Sans MS', cursive; font-size: 11px;">v2.194.0 [+] [x]</span>`;
    document.body.appendChild(overlay);

    const snap = collectSnapshot();
    const families = snap.fonts.map((f) => f.family.toLowerCase());
    expect(families.some((f) => f.includes("comic"))).toBe(false);
    const colors = snap.colors.map((c) => c.value);
    expect(colors).not.toContain("#ff0080");
    const selectors = snap.computedSamples.map((s) => s.selector);
    expect(selectors.some((s) => s.startsWith("dev-overlay-widget") || s.includes("span"))).toBe(false);
  });
});