import { describe, expect, it } from "vitest";
import { applyTemplate, domainFromUrl, localTimestamp, sanitize } from "../filename";

describe("filename", () => {
  it("strips www and replaces dots", () => {
    expect(domainFromUrl("https://www.example.com/x")).toBe("example_com");
  });
  it("falls back for invalid url", () => {
    expect(domainFromUrl("not a url")).toBe("page");
  });
  it("formats local timestamp", () => {
    const t = localTimestamp(new Date(2026, 4, 6, 9, 7, 3));
    expect(t).toBe("20260506-090703");
  });
  it("sanitizes special chars and collapses dashes", () => {
    expect(sanitize("Hello World!!.zip")).toBe("hello-world.zip");
  });
  it("preserves extension under length cap", () => {
    const long = "a".repeat(200) + ".zip";
    const s = sanitize(long);
    expect(s.endsWith(".zip")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(120);
  });
  it("applies template tokens", () => {
    expect(
      applyTemplate("llm-export-fullpage-{domain}-{timestamp}.zip", {
        domain: "example_com",
        timestamp: "20260506-090703",
      }),
    ).toBe("llm-export-fullpage-example_com-20260506-090703.zip");
  });
  it("drops empty tokens cleanly", () => {
    expect(applyTemplate("a-{missing}-b", {})).toBe("a-b");
  });
});
