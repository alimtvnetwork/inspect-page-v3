import { describe, expect, it } from "vitest";
import { fmtBytes, telemetryRows, type TelemetryCounts } from "../telemetry";

const empty: TelemetryCounts = {
  inlineStyles: 0,
  linkedStylesheets: 0,
  unreachableStylesheets: 0,
  inlineScripts: 0,
  linkedScripts: 0,
  unreachableScripts: 0,
  captureFrames: 0,
};

describe("fmtBytes", () => {
  it("formats 0 and negative as '0 B'", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(-1)).toBe("0 B");
    expect(fmtBytes(NaN)).toBe("0 B");
  });
  it("uses byte unit for small values", () => {
    expect(fmtBytes(512)).toBe("512 B");
  });
  it("scales to KB / MB / GB with one decimal under 10", () => {
    expect(fmtBytes(1024)).toBe("1.0 KB");
    expect(fmtBytes(2048)).toBe("2.0 KB");
    expect(fmtBytes(15 * 1024)).toBe("15 KB");
    expect(fmtBytes(1024 * 1024)).toBe("1.0 MB");
    expect(fmtBytes(7.5 * 1024 * 1024)).toBe("7.5 MB");
    expect(fmtBytes(1024 ** 3)).toBe("1.0 GB");
  });
});

describe("telemetryRows", () => {
  it("returns no rows when nothing is captured", () => {
    expect(telemetryRows(empty)).toEqual([]);
  });

  it("emits stylesheet and frame rows when counts are present", () => {
    const rows = telemetryRows({
      ...empty,
      inlineStyles: 2,
      linkedStylesheets: 5,
      captureFrames: 3,
    });
    expect(rows).toEqual([
      ["stylesheets", "7"],
      ["screenshot tiles", "3"],
    ]);
  });

  it("includes shadow roots, fonts (with bytes), and iframe split", () => {
    const rows = telemetryRows({
      ...empty,
      shadowRootsExpanded: 12,
      fontsInlined: 4,
      fontsBytesInlined: 256_000,
      iframesSameOrigin: 2,
      iframesCrossOrigin: 1,
      linkedStylesheets: 3,
    });
    const labels = rows.map((r) => r[0]);
    expect(labels).toEqual([
      "shadow roots",
      "fonts",
      "same-origin iframes",
      "cross-origin iframes (skipped)",
      "stylesheets",
    ]);
    expect(rows.find((r) => r[0] === "fonts")?.[1]).toBe("4 (250 KB)");
    expect(rows.find((r) => r[0] === "shadow roots")?.[1]).toBe("12");
  });

  it("omits font byte suffix when bytesInlined is missing", () => {
    const rows = telemetryRows({
      ...empty,
      fontsInlined: 1,
    });
    expect(rows.find((r) => r[0] === "fonts")?.[1]).toBe("1");
  });

  it("omits zero-valued optional counters", () => {
    const rows = telemetryRows({
      ...empty,
      shadowRootsExpanded: 0,
      fontsInlined: 0,
      iframesCrossOrigin: 0,
    });
    expect(rows).toEqual([]);
  });
});