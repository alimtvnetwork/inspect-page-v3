/**
 * Post-export action card for Full Page captures.
 * Extracted from ExportPanel.tsx (B1 refactor).
 */
import { useCallback, useState } from "react";
import JSZip from "jszip";
import { COPY } from "@shared/copy";
import type { ExportArtifacts } from "@shared/types";
import { ExportFlow } from "@shared/enums";
import { ExportModes } from "./ExportModes";
import { buildFullPageArtifacts, type FullPageArtifactSource } from "./artifacts";
import { saveBlobWithPrompt } from "./save-blob-with-prompt";

const domainSafeFor = (artifacts: FullPageArtifactSource | null | undefined): string => {
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
const sanitizeFileBase = (s: string): string =>
  s.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").replace(/^\.+/, "").slice(0, 120);
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> =>
  (await fetch(dataUrl)).blob();
const fenceFor = (k: "html" | "css" | "js"): string =>
  k === "js" ? "javascript" : k;
const buildSingleMd = (artifacts: FullPageArtifactSource | null | undefined, k: "html" | "css" | "js"): string =>
  artifacts
    ? `# Page — ${artifacts.meta.url}\n\n## ${k.toUpperCase()}\n\n\`\`\`${fenceFor(k)}\n${artifacts[k] || ""}\n\`\`\`\n`
    : "";
const buildCombinedMd = (artifacts: FullPageArtifactSource | null | undefined): string =>
  artifacts
    ? `# Page — ${artifacts.meta.url}\n\n_Captured ${artifacts.meta.capturedAtIso}_\n\n## HTML\n\n\`\`\`html\n${artifacts.html}\n\`\`\`\n\n## CSS\n\n\`\`\`css\n${artifacts.css}\n\`\`\`\n\n## JS\n\n\`\`\`javascript\n${artifacts.js}\n\`\`\`\n`
    : "";

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
  const [customName, setCustomName] = useState<string>("");
  const ready = !!artifacts;
  const effectiveBase = (suffix?: string): string => {
    const safe = domainSafeFor(artifacts);
    const ts = tsNow();
    const cleaned = sanitizeFileBase(customName.trim());
    const base = cleaned || `inspect-page-fullpage-${safe}-${ts}`;
    return suffix ? `${base}-${suffix}` : base;
  };

  const onDownloadOne = useCallback(async (k: "html" | "css" | "js") => {
    if (!artifacts) return;
    if (fmt === "md") {
      await saveBlobWithPrompt(
        new Blob([buildSingleMd(artifacts, k)], { type: "text/markdown;charset=utf-8" }),
        `${effectiveBase(k)}.md`,
      );
    } else {
      const mime =
        k === "html" ? "text/html"
        : k === "css" ? "text/css"
        : "text/javascript";
      await saveBlobWithPrompt(
        new Blob([artifacts[k] || ""], { type: `${mime};charset=utf-8` }),
        `${effectiveBase()}.${k}`,
      );
    }
  }, [artifacts, fmt, customName]);

  const onDownloadScreenshot = useCallback(async () => {
    if (!artifacts) return;
    try {
      const blob = await dataUrlToBlob(artifacts.screenshotDataUrl);
      const ext = blob.type.includes("jpeg") ? "jpg" : "png";
      await saveBlobWithPrompt(blob, `${effectiveBase("screenshot")}.${ext}`);
    } catch { /* ignore */ }
  }, [artifacts, customName]);

  const onDownloadAll = useCallback(async () => {
    if (!artifacts) return;
    try {
      const zip = new JSZip();
      if (fmt === "md") {
        zip.file("page.md", buildCombinedMd(artifacts));
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
      await saveBlobWithPrompt(blob, `${effectiveBase()}.zip`);
    } catch { /* ignore */ }
  }, [artifacts, fmt, customName]);

  // Stub artifacts for ExportModes when nothing has been captured yet — gives
  // the user a preview of every export mode button without forcing a capture.
  const stubExportArtifacts: ExportArtifacts = {
    flow: ExportFlow.FullPage,
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
      <div className="lpe-debug-note" role="note">
        {ready
          ? <>Tip: set a custom file name below — leave blank to use the auto name <code>{`inspect-page-fullpage-${domainSafeFor(artifacts)}-…`}</code>.</>
          : <>Run <strong>Export Full Page</strong> above first — these become active once the capture lands.</>}
      </div>
      <label className="lpe-field-row" style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0 8px" }}>
        <span style={{ fontSize: 12, opacity: 0.85, minWidth: 72 }}>File name:</span>
        <input
          type="text"
          className="lpe-input"
          style={{ flex: 1 }}
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={ready ? `inspect-page-fullpage-${domainSafeFor(artifacts)}-${tsNow()}` : "my-export-name"}
          aria-label="Custom file name (without extension)"
          spellCheck={false}
        />
      </label>
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
        customBaseName={sanitizeFileBase(customName.trim()) || undefined}
      />
    </div>
  );
}