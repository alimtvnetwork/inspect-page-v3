/**
 * Element-pick debug preview card (HTML/CSS/JS tabs, format toggle,
 * download/copy actions, plus the four-mode export toolbar).
 * Extracted from ExportPanel.tsx (B1 refactor).
 */
import { useCallback, useState } from "react";
import JSZip from "jszip";
import { COPY } from "@shared/copy";
import type { ExportArtifacts, StatusUpdatePayload } from "@shared/types";
import { ExportModes } from "./ExportModes";
import { buildElementArtifacts } from "./artifacts";

export interface DebugPreviewProps {
  preview: NonNullable<StatusUpdatePayload["debugPreview"]>;
  activeUrl?: string;
  shareEnabled?: boolean;
  onShare?: (artifacts: ExportArtifacts) => Promise<void>;
  onClear: () => void;
}

export function DebugPreview({ preview, activeUrl, shareEnabled, onShare, onClear }: DebugPreviewProps): JSX.Element {
  const [tab, setTab] = useState<"html" | "css" | "js">("html");
  const [fmt, setFmt] = useState<"raw" | "md">("raw");
  const value = preview[tab];
  const onCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
  }, [value]);

  const safeName = (): string => {
    return (preview.selectorPath || "element")
      .split(" > ").pop()!
      .replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40) || "element";
  };
  const tsNow = (): string =>
    new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const triggerDownload = (blob: Blob, filename: string): void => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const fenceFor = (k: "html" | "css" | "js"): string =>
    k === "js" ? "javascript" : k;
  const buildSingleMd = (k: "html" | "css" | "js", v: string): string =>
    `# Element — ${preview.selectorPath}\n\n## ${k.toUpperCase()}\n\n\`\`\`${fenceFor(k)}\n${v}\n\`\`\`\n`;
  const buildCombinedMd = (): string =>
    `# Element — ${preview.selectorPath}\n\n## HTML\n\n\`\`\`html\n${preview.html || ""}\n\`\`\`\n\n## CSS\n\n\`\`\`css\n${preview.css || ""}\n\`\`\`\n\n## JS\n\n\`\`\`javascript\n${preview.js || ""}\n\`\`\`\n`;

  const onDownloadCurrent = useCallback(() => {
    try {
      const safe = safeName();
      const ts = tsNow();
      if (fmt === "md") {
        const md = buildSingleMd(tab, value || "");
        triggerDownload(
          new Blob([md], { type: "text/markdown;charset=utf-8" }),
          `inspect-page-element-${safe}-${tab}-${ts}.md`,
        );
      } else {
        const mime =
          tab === "html" ? "text/html"
          : tab === "css" ? "text/css"
          : "text/javascript";
        triggerDownload(
          new Blob([value || ""], { type: `${mime};charset=utf-8` }),
          `inspect-page-element-${safe}-${ts}.${tab}`,
        );
      }
    } catch { /* ignore */ }
  }, [preview, tab, value, fmt]);

  const onDownloadAll = useCallback(async () => {
    try {
      const safe = safeName();
      const ts = tsNow();
      const zip = new JSZip();
      if (fmt === "md") {
        zip.file("element.md", buildCombinedMd());
      } else {
        zip.file("element.html", preview.html || "");
        zip.file("element.css", preview.css || "");
        zip.file("element.js", preview.js || "");
      }
      zip.file("selector.txt", `${preview.selectorPath}\n`);
      const blob = await zip.generateAsync({ type: "blob" });
      triggerDownload(blob, `inspect-page-element-${safe}-${ts}.zip`);
    } catch { /* ignore */ }
  }, [preview, fmt]);
  return (
    <div className="lpe-debug" aria-label={COPY.debugHeader}>
      <div className="lpe-debug-header">
        <span className="lpe-debug-title">{COPY.debugHeader}</span>
        <button type="button" className="lpe-header-btn" onClick={onClear} aria-label={COPY.debugClear}>✕</button>
      </div>
      <div className="lpe-debug-selector" title={preview.selectorPath}>
        <span className="lpe-telemetry-label">{COPY.debugSelector}: </span>
        <code>{preview.selectorPath}</code>
      </div>
      <div className="lpe-debug-tabs" role="tablist">
        {(["html", "css", "js"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`lpe-debug-tab${tab === k ? " is-active" : ""}`}
            onClick={() => setTab(k)}
          >
            {k === "html" ? COPY.debugTabHtml : k === "css" ? COPY.debugTabCss : COPY.debugTabJs}
            <span className="lpe-debug-count">{preview[k].length}</span>
          </button>
        ))}
      </div>
      <div className="lpe-debug-actions">
        <span className="lpe-debug-fmt" role="group" aria-label={COPY.debugFormatLabel}>
          <span>{COPY.debugFormatLabel}:</span>
          <button
            type="button"
            className="lpe-debug-fmt-btn"
            aria-pressed={fmt === "raw"}
            onClick={() => setFmt("raw")}
          >{COPY.debugFormatRaw}</button>
          <button
            type="button"
            className="lpe-debug-fmt-btn"
            aria-pressed={fmt === "md"}
            onClick={() => setFmt("md")}
          >{COPY.debugFormatMd}</button>
        </span>
        <span className="lpe-spacer" />
        <button type="button" className="lpe-btn" onClick={onCopy}>
          {COPY.debugCopy}
        </button>
        <button type="button" className="lpe-btn" onClick={onDownloadCurrent}>
          {COPY.debugDownloadCurrent}
        </button>
        <button type="button" className="lpe-btn lpe-btn-primary" onClick={onDownloadAll}>
          {COPY.debugDownloadAll}
        </button>
      </div>
      {tab === "js" && (
        <div className="lpe-debug-note">{COPY.debugJsEmpty}</div>
      )}
      <pre className="lpe-debug-pre"><code>{value || "(empty)"}</code></pre>
      <ExportModes
        artifacts={buildElementArtifacts(preview, activeUrl)}
        shareEnabled={shareEnabled}
        onShare={onShare}
      />
    </div>
  );
}