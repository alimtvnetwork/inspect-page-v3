/**
 * v2 — four-mode export toolbar shared by Pick Element and Full Page flows.
 * Source: spec/21-app/24-export-modes.md.
 *
 * Renders [ MD ] [ MD + files ] [ ZIP ] [ Share Links ] buttons. The
 * Share Links button is disabled in V2 (wiring lands in V7).
 */
import { useCallback } from "react";
import JSZip from "jszip";
import { COPY } from "@shared/copy";
import { ExportFlow } from "@shared/enums";
import type { ExportArtifacts } from "@shared/types";
import { buildPromptMd } from "@share/buildPromptMd";

export interface ExportModesProps {
  artifacts: ExportArtifacts;
  /** Becomes true once V7 ships; for now always false. */
  shareEnabled?: boolean;
  onShare?: () => void;
}

function tsNow(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function safeDomain(d: string): string {
  return (d || "page").replace(/^www\./, "").replace(/[^a-z0-9_-]+/gi, "_");
}

function triggerDownload(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function flowSlug(f: ExportFlow): string {
  return f === ExportFlow.FullPage ? "fullpage" : "element";
}

function fileBaseName(a: ExportArtifacts): string {
  return `pageport-${flowSlug(a.flow)}-${safeDomain(a.domain)}-${tsNow()}`;
}

/** Build the single-file MD: AI block + inlined html/css/js fences + base64 images. */
function buildSingleMd(a: ExportArtifacts): string {
  const ai = buildPromptMd(a, { mode: "single" });
  const parts: string[] = [ai, "", "## HTML", "", "```html", a.html || "", "```", ""];
  if (a.css) parts.push("## CSS", "", "```css", a.css, "```", "");
  if (a.js) parts.push("## JS", "", "```javascript", a.js, "```", "");
  for (const img of a.images) {
    parts.push(
      `## ${img.name}`,
      "",
      `![${img.name}](data:${img.mime};base64,${img.base64})`,
      "",
    );
  }
  return parts.join("\n");
}

function buildMdFilesMd(a: ExportArtifacts): string {
  const ai = buildPromptMd(a, { mode: "mdFiles" });
  return `${ai}\n\n_See \`./index.html\`, \`./style.css\`, and the \`./images/\` folder for the captured assets._\n`;
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function ExportModes({
  artifacts,
  shareEnabled = false,
  onShare,
}: ExportModesProps): JSX.Element {
  const onMd = useCallback(() => {
    const md = buildSingleMd(artifacts);
    triggerDownload(
      new Blob([md], { type: "text/markdown;charset=utf-8" }),
      `${fileBaseName(artifacts)}.md`,
    );
  }, [artifacts]);

  const onMdFiles = useCallback(async () => {
    const zip = new JSZip();
    zip.file("prompt.md", buildMdFilesMd(artifacts));
    if (artifacts.html) zip.file("index.html", artifacts.html);
    if (artifacts.css) zip.file("style.css", artifacts.css);
    for (const img of artifacts.images) {
      zip.file(`images/${img.name}`, base64ToUint8(img.base64));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, `${fileBaseName(artifacts)}-mdfiles.zip`);
  }, [artifacts]);

  const onZip = useCallback(async () => {
    const zip = new JSZip();
    zip.file("prompt.md", buildPromptMd(artifacts, { mode: "zip" }));
    if (artifacts.html) zip.file("index.html", artifacts.html);
    if (artifacts.css) zip.file("style.css", artifacts.css);
    if (artifacts.js) zip.file("script.js", artifacts.js);
    for (const img of artifacts.images) {
      zip.file(`images/${img.name}`, base64ToUint8(img.base64));
    }
    zip.file("manifest.json", `${JSON.stringify(artifacts.meta, null, 2)}\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, `${fileBaseName(artifacts)}.zip`);
  }, [artifacts]);

  return (
    <div className="lpe-export-modes" aria-label={COPY.exportModesHeader}>
      <div className="lpe-debug-title">{COPY.exportModesHeader}</div>
      <div className="lpe-debug-actions">
        <button type="button" className="lpe-btn" onClick={onMd}>
          {COPY.exportModeMd}
        </button>
        <button type="button" className="lpe-btn" onClick={onMdFiles}>
          {COPY.exportModeMdFiles}
        </button>
        <button type="button" className="lpe-btn lpe-btn-primary" onClick={onZip}>
          {COPY.exportModeZip}
        </button>
        <button
          type="button"
          className="lpe-btn"
          onClick={onShare}
          disabled={!shareEnabled}
          title={shareEnabled ? undefined : COPY.exportModeShareDisabledTip}
        >
          {COPY.exportModeShare}
        </button>
      </div>
    </div>
  );
}