/**
 * Pure builders that turn picker/full-page capture results into the shared
 * `ExportArtifacts` shape consumed by `ExportModes`. Extracted from
 * `ExportPanel.tsx` (B1 refactor).
 */
import { ExportFlow } from "@shared/enums";
import type {
  ExportArtifacts,
  ExportMeta,
  StatusUpdatePayload,
} from "@shared/types";
import { asElementSnapshot } from "@shared/narrow";

export interface FullPageArtifactSource {
  html: string;
  css: string;
  js: string;
  screenshotDataUrl: string;
  meta: ExportMeta;
}

export function deriveDomain(url: string | undefined): string {
  if (!url) return "page";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "page";
  }
}

export function buildElementArtifacts(
  preview: NonNullable<StatusUpdatePayload["debugPreview"]>,
  activeUrl: string | undefined,
): ExportArtifacts {
  return {
    flow: ExportFlow.Element,
    domain: deriveDomain(activeUrl),
    html: preview.html || "",
    css: preview.css || "",
    js: preview.js || "",
    images: [],
    // meta is unused by ExportModes for element flow.
    meta: {} as ExportArtifacts["meta"],
  };
}

/**
 * v2.7.2 — combine N picked elements into a single ExportArtifacts so the
 * existing four-mode toolbar (MD / MD+files / ZIP / Smart Share) produces
 * one merged file with per-element sections in click order.
 */
export function buildCombinedElementArtifacts(
  picks: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>,
  activeUrl: string | undefined,
): ExportArtifacts {
  const htmlParts: string[] = [];
  const cssParts: string[] = [];
  const jsParts: string[] = [];
  const preludeParts: string[] = [];
  picks.forEach((p, i) => {
    const n = i + 1;
    const header = `Element ${n} — ${p.selectorPath}`;
    htmlParts.push(`<!-- ${header} -->`, p.debugPreview.html || "", "");
    if (p.debugPreview.css) {
      cssParts.push(`/* ${header} */`, p.debugPreview.css, "");
    }
    if (p.debugPreview.js) {
      jsParts.push(`/* ${header} */`, p.debugPreview.js, "");
    }
    const s = p.source;
    const snap = asElementSnapshot(p.elementSnapshot);
    const cssSel = snap?.identity.selectorPath ?? p.selectorPath;
    const xpath = snap?.identity.xpath ?? "";
    preludeParts.push(`## Source — Element ${n}`);
    preludeParts.push(`- URL: ${s?.url ?? activeUrl ?? ""}`);
    preludeParts.push(`- Captured: ${s?.capturedAtIso ?? ""}`);
    preludeParts.push(`- Selector path: ${p.selectorPath}`);
    preludeParts.push(`- CSS selector: ${cssSel}`);
    if (xpath) preludeParts.push(`- XPath: ${xpath}`);
    preludeParts.push(`- Page title: ${s?.pageTitle ?? ""}`);
    if (s?.viewport) {
      preludeParts.push(`- Viewport: ${s.viewport.w}×${s.viewport.h} CSS px @ DPR ${s.dpr}`);
    }
    preludeParts.push("");
  });
  return {
    flow: ExportFlow.Element,
    domain: deriveDomain(activeUrl),
    html: htmlParts.join("\n").trim(),
    css: cssParts.join("\n").trim(),
    js: jsParts.join("\n").trim(),
    images: [],
    meta: {} as ExportArtifacts["meta"],
    prelude: preludeParts.join("\n").trim() + "\n",
  };
}

export function buildFullPageArtifacts(
  src: FullPageArtifactSource,
  activeUrl: string | undefined,
): ExportArtifacts {
  const url = activeUrl || src.meta.url || "";
  let domain = "page";
  try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep default */ }
  // Parse data URL: "data:<mime>;base64,<b64>"
  let mime = "image/png";
  let base64 = "";
  const m = /^data:([^;]+);base64,(.*)$/.exec(src.screenshotDataUrl || "");
  if (m && m[1] && m[2] !== undefined) { mime = m[1]; base64 = m[2]; }
  const ext = mime.includes("jpeg") ? "jpg" : "png";
  return {
    flow: ExportFlow.FullPage,
    domain,
    html: src.html,
    css: src.css,
    js: src.js,
    images: base64 ? [{ name: `screenshot.${ext}`, mime, base64 }] : [],
    meta: src.meta,
  };
}