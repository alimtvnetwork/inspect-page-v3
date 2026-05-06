/**
 * Helpers for the "Captured in this export" telemetry block shown in
 * the panel after a successful Full Page export. Pure functions; safe
 * to unit-test without a DOM.
 */
import { COPY } from "@shared/copy";
import type { ExportMeta } from "@shared/types";

export type TelemetryCounts = ExportMeta["counts"];

/** Format a positive byte count in a compact, panel-friendly way. */
export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/**
 * Build the [label, value] rows for the telemetry block. Only includes
 * rows whose count is meaningful (non-zero), so a minimal page produces
 * a minimal block.
 */
export function telemetryRows(c: TelemetryCounts): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (typeof c.shadowRootsExpanded === "number" && c.shadowRootsExpanded > 0) {
    rows.push([COPY.telemetryShadowRoots, String(c.shadowRootsExpanded)]);
  }
  if (typeof c.fontsInlined === "number" && c.fontsInlined > 0) {
    const bytes =
      typeof c.fontsBytesInlined === "number"
        ? ` (${fmtBytes(c.fontsBytesInlined)})`
        : "";
    rows.push([COPY.telemetryFonts, `${c.fontsInlined}${bytes}`]);
  }
  if (typeof c.iframesSameOrigin === "number" && c.iframesSameOrigin > 0) {
    rows.push([COPY.telemetryIframesSame, String(c.iframesSameOrigin)]);
  }
  if (typeof c.iframesCrossOrigin === "number" && c.iframesCrossOrigin > 0) {
    rows.push([COPY.telemetryIframesCross, String(c.iframesCrossOrigin)]);
  }
  const sheets = c.linkedStylesheets + c.inlineStyles;
  if (sheets > 0) rows.push([COPY.telemetryStylesheets, String(sheets)]);
  if (c.captureFrames > 0) rows.push([COPY.telemetryFrames, String(c.captureFrames)]);
  // ---- v1.1 element-export rows (only populated by runElementExport) ----
  if (typeof c.elementOuterHtmlBytes === "number" && c.elementOuterHtmlBytes > 0) {
    rows.push([COPY.telemetryElementOuterHtml, fmtBytes(c.elementOuterHtmlBytes)]);
  }
  if (typeof c.elementMatchedRules === "number" && c.elementMatchedRules > 0) {
    rows.push([COPY.telemetryElementMatchedRules, String(c.elementMatchedRules)]);
  }
  if (typeof c.elementComputedDiffEntries === "number" && c.elementComputedDiffEntries > 0) {
    rows.push([COPY.telemetryElementComputedDiff, String(c.elementComputedDiffEntries)]);
  }
  if (typeof c.elementContextPngBytes === "number" && c.elementContextPngBytes > 0) {
    const isolated =
      c.elementIsolatedSkipped === true
        ? COPY.telemetryElementIsolatedSkipped
        : typeof c.elementIsolatedPngBytes === "number" && c.elementIsolatedPngBytes > 0
          ? fmtBytes(c.elementIsolatedPngBytes)
          : null;
    const value = isolated
      ? `${fmtBytes(c.elementContextPngBytes)} + ${isolated}`
      : fmtBytes(c.elementContextPngBytes);
    rows.push([COPY.telemetryElementScreenshots, value]);
  }
  return rows;
}