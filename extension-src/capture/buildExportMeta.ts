/**
 * P4 — Build ExportMeta. Source: spec/21-app/03 + 17.
 */
import type { ExportMeta } from "@shared/types";
import type { CssCounts } from "./collectCss";
import type { JsCounts } from "./collectJs";

export interface BuildMetaInput {
  css: CssCounts;
  js: JsCounts;
  captureFrames: number;
  extensionVersion: string;
}

export function buildExportMeta(input: BuildMetaInput, doc: Document = document): ExportMeta {
  const url = doc.location?.href ?? "";
  const w = (typeof window !== "undefined" ? window : { innerWidth: 0, innerHeight: 0, devicePixelRatio: 1 }) as Window;
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return {
    schemaVersion: 1,
    kind: "fullPage",
    url,
    title: doc.title ?? "",
    capturedAtIso: new Date().toISOString(),
    viewportCssPx: { w: w.innerWidth, h: w.innerHeight },
    pageCssPx: {
      w: doc.documentElement?.scrollWidth ?? 0,
      h: doc.documentElement?.scrollHeight ?? 0,
    },
    devicePixelRatio: w.devicePixelRatio ?? 1,
    userAgent: ua,
    counts: {
      inlineStyles: input.css.inlineStyles,
      linkedStylesheets: input.css.linkedStylesheets,
      unreachableStylesheets: input.css.unreachableStylesheets,
      inlineScripts: input.js.inlineScripts,
      linkedScripts: input.js.linkedScripts,
      unreachableScripts: input.js.unreachableScripts,
      captureFrames: input.captureFrames,
    },
    extensionVersion: input.extensionVersion,
  };
}
