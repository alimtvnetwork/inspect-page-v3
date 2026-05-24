/**
 * Post-export action card for Full Page captures.
 * Extracted from ExportPanel.tsx (B1 refactor).
 */
import { useCallback, useState } from "react";
import JSZip from "jszip";
import { COPY } from "@shared/copy";
import type { ExportArtifacts } from "@shared/types";
import { ExportModes } from "./ExportModes";
import { buildFullPageArtifacts, type FullPageArtifactSource } from "./artifacts";
import { saveBlobWithPrompt } from "./save-blob-with-prompt";

export interface FullPageActionsProps {
  /** Captured artifacts. When null/undefined the section renders in a
   *  ghost/disabled state — buttons are visible but inert with a one-line
   *  hint so the user can preview the full Export surface upfront. */
  artifacts?: FullPageArtifactSource | null;
  activeUrl?: string;
  shareEnabled?: boolean;
  onShare?: (artifacts: ExportArtifacts) => Promise<void>;
}

export function FullPageActions({ artifacts, activeUrl, shareEnabled, onShare }: FullPageActionsProps): JSX.Element {
  const [fmt, setFmt] = useState<"raw" | "md">("raw");
  const ready = !!artifacts;

  const domainSafe = (): string => {
    if (!artifacts) return "page";
    try {
      const u = new URL(artifacts.meta.url);
      return u.hostname.replace(/^www\./, "").replace(/[^a-z0-9_-]+/gi, "_");
    } catch {
      return "page";
    }
  };
  const tsNow = (): string =>
    new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> =>
    (await fetch(dataUrl)).blob();
  const fenceFor = (k: "html" | "css" | "js"): string =>
    k === "js" ? "javascript" : k;
  const buildSingleMd = (k: "html" | "css" | "js"): string =>
    artifacts
      ? `# Page — ${artifacts.meta.url}\n\n## ${k.toUpperCase()}\n\n\`\`\`${fenceFor(k)}\n${artifacts[k] || ""}\n\`\`\`\n`
      : "";
  const buildCombinedMd = (): string =>
    artifacts
      ? `# Page — ${artifacts.meta.url}\n\n_Captured ${artifacts.meta.capturedAtIso}_\n\n## HTML\n\n\`\`\`html\n${artifacts.html}\n\`\`\`\n\n## CSS\n\n\`\`\`css\n${artifacts.css}\n\`\`\`\n\n## JS\n\n\`\`\`javascript\n${artifacts.js}\n\`\`\`\n`
      : "";

  const onDownloadOne = useCallback(async (k: "html" | "css" | "js") => {
    if (!artifacts) return;
    const safe = domainSafe();
    const ts = tsNow();
    if (fmt === "md") {
      await saveBlobWithPrompt(
        new Blob([buildSingleMd(k)], { type: "text/markdown;charset=utf-8" }),
        `inspect-page-fullpage-${safe}-${k}-${ts}.md`,
      );
    } else {
      const mime =
        k === "html" ? "text/html"
        : k === "css" ? "text/css"
        : "text/javascript";
      await saveBlobWithPrompt(
        new Blob([artifacts[k] || ""], { type: `${mime};charset=utf-8` }),
        `inspect-page-fullpage-${safe}-${ts}.${k}`,
      );
    }
  }, [artifacts, fmt]);

  const onDownloadScreenshot = useCallback(async () => {
    if (!artifacts) return;
    try {
      const blob = await dataUrlToBlob(artifacts.screenshotDataUrl);
      const ext = blob.type.includes("jpeg") ? "jpg" : "png";
      await saveBlobWithPrompt(blob, `inspect-page-fullpage-${domainSafe()}-${tsNow()}.${ext}`);
    } catch { /* ignore */ }
  }, [artifacts]);

  const onDownloadAll = useCallback(async () => {
    if (!artifacts) return;
    try {
      const safe = domainSafe();
      const ts = tsNow();
      const zip = new JSZip();
      if (fmt === "md") {
        zip.file("page.md", buildCombinedMd());
      } else {
        zip.file("page.html", artifacts.html);
        zip.file("styles.css", artifacts.css);
        zip.file("scripts.js", artifacts.js);
      }
      try {
        const shot = await dataUrlToBlob(artifacts.screenshotDataUrl);
        const ext = shot.type.includes("jpeg") ? "jpg" : "png";
        zip.file(`screenshot.${ext}`, shot);
      } catch { /* skip screenshot if conversion fails */ }
      zip.file("manifest.json", `${JSON.stringify(artifacts.meta, null, 2)}\n`);
      const blob = await zip.generateAsync({ type: "blob" });
      await saveBlobWithPrompt(blob, `inspect-page-fullpage-${safe}-${ts}.zip`);
    } catch { /* ignore */ }
  }, [artifacts, fmt]);

  // Stub artifacts for ExportModes when nothing has been captured yet — gives
  // the user a preview of every export mode button without forcing a capture.
  const stubExportArtifacts: ExportArtifacts = {
    flow: "fullPage" as ExportArtifacts["flow"],
    domain: "page",
    html: "",
    css: "",
    js: "",
    images: [],
    prelude: "",
    meta: {
      url: activeUrl ?? "",
      capturedAtIso: new Date().toISOString(),
    } as ExportArtifacts["meta"],
  };

  return (
    <div className="lpe-debug" data-ready={ready ? "true" : "false"} aria-label={COPY.fullPageActionsHeader}>
      <div className="lpe-debug-header">
        <span className="lpe-debug-title">{COPY.fullPageActionsHeader}</span>
      </div>
      {!ready && (
        <div className="lpe-debug-note" role="note">
          Run <strong>Export Full Page</strong> above first — these become active once the capture lands.
        </div>
      )}
      <div className="lpe-debug-actions">
        <span className="lpe-debug-fmt" role="group" aria-label={COPY.debugFormatLabel}>
          <span>{COPY.debugFormatLabel}:</span>
          <button
            type="button"
            className="lpe-debug-fmt-btn"
            aria-pressed={fmt === "raw"}
            onClick={() => setFmt("raw")}
            disabled={!ready}
          >{COPY.debugFormatRaw}</button>
          <button
            type="button"
            className="lpe-debug-fmt-btn"
            aria-pressed={fmt === "md"}
            onClick={() => setFmt("md")}
            disabled={!ready}
          >{COPY.debugFormatMd}</button>
        </span>
        <span className="lpe-spacer" />
        <button type="button" className="lpe-btn" onClick={() => onDownloadOne("html")} disabled={!ready}>
          {COPY.fullPageDownloadHtml}
        </button>
        <button type="button" className="lpe-btn" onClick={() => onDownloadOne("css")} disabled={!ready}>
          {COPY.fullPageDownloadCss}
        </button>
        <button type="button" className="lpe-btn" onClick={() => onDownloadOne("js")} disabled={!ready}>
          {COPY.fullPageDownloadJs}
        </button>
        <button type="button" className="lpe-btn" onClick={onDownloadScreenshot} disabled={!ready}>
          {COPY.fullPageDownloadScreenshot}
        </button>
        <button type="button" className="lpe-btn lpe-btn-primary" onClick={onDownloadAll} disabled={!ready}>
          {COPY.fullPageDownloadAllZip}
        </button>
      </div>
      <ExportModes
        artifacts={ready ? buildFullPageArtifacts(artifacts!, activeUrl) : stubExportArtifacts}
        shareEnabled={ready && shareEnabled}
        onShare={onShare}
        disabled={!ready}
      />
    </div>
  );
}