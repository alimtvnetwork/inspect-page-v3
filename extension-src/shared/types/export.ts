/**
 * Export metadata, geometry, and v2 export-artifact types. Split from
 * shared/types.ts (S2).
 */
import type { ExportFlow } from "../enums";

// ---- Export metadata ----
export interface ExportMeta {
  schemaVersion: 1;
  kind: "fullPage";
  url: string;
  title: string;
  capturedAtIso: string;
  viewportCssPx: { w: number; h: number };
  pageCssPx: { w: number; h: number };
  devicePixelRatio: number;
  userAgent: string;
  counts: {
    inlineStyles: number;
    linkedStylesheets: number;
    unreachableStylesheets: number;
    inlineScripts: number;
    linkedScripts: number;
    unreachableScripts: number;
    captureFrames: number;
    fontsInlined?: number;
    fontsBytesInlined?: number;
    fontsFailed?: number;
    iframesTotal?: number;
    iframesSameOrigin?: number;
    iframesCrossOrigin?: number;
    iframesFailed?: number;
    /** v1.1: total open shadow roots expanded by the serializer. */
    shadowRootsExpanded?: number;
    /**
     * v1.1 element-export telemetry. These fields are only populated by
     * `runElementExport` and surfaced in the "Captured in this export"
     * panel block alongside the full-page counters.
     */
    elementOuterHtmlBytes?: number;
    elementMatchedRules?: number;
    elementComputedDiffEntries?: number;
    elementContextPngBytes?: number;
    elementIsolatedPngBytes?: number;
    elementIsolatedSkipped?: boolean;
  };
  extensionVersion: string;
}

// ---- Geometry ----
export interface DomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---- v2 export artifacts ----
/**
 * In-memory artifact bundle handed to the v2 export-mode toolbar.
 * Source: spec/21-app/24-export-modes.md.
 */
export interface ExportImage {
  /** Filename used inside MD+files / ZIP exports (e.g. "screenshot.png"). */
  name: string;
  /** MIME type, e.g. "image/png". */
  mime: string;
  /** Base64-encoded image data, no data: prefix. */
  base64: string;
}

export interface ExportArtifacts {
  flow: ExportFlow;
  /** Site domain for filename templating. */
  domain: string;
  html: string;
  css: string;
  js: string;
  images: ExportImage[];
  meta: ExportMeta;
  /**
   * v2.7.2 — optional markdown inserted after the AI instruction block and
   * before the HTML section in every export mode. Used by the multi-element
   * picker to surface per-element `## Source` metadata.
   */
  prelude?: string;
}

/**
 * v2.7.5 — optional Color-Token addons attached when an Inspect snapshot is
 * available. ExportModes weaves these into the MD body and drops the two
 * CSS files into ZIPs.
 */
export interface ColorTokenExportAddons {
  mdBlock: string;
  tokensCss: string;
  selectorsCss: string;
  customCssBlock: string;
  tokenCount: number;
}