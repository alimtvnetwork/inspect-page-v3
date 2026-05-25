/**
 * v2 — four-mode export toolbar shared by Pick Element and Full Page flows.
 * Source: spec/21-app/24-export-modes.md.
 *
 * Renders [ MD ] [ MD + files ] [ ZIP ] [ Share Links ] buttons. The
 * Share Links button is disabled in V2 (wiring lands in V7).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { COPY } from "@shared/copy";
import { ExportFlow } from "@shared/enums";
import type { ExportArtifacts } from "@shared/types";
import { buildPromptMd } from "@share/build-prompt-md";
import {
  loadColorTokenAddons, emptyColorTokenAddons, type ColorTokenAddons,
} from "../inspect/color-tokens-export";
import { snapshotCache } from "./inspect/snapshot-cache";
import type { InspectSnapshot } from "../inspect/types";
import { asInspectSnapshot } from "@shared/narrow";

export interface ExportModesProps {
  artifacts: ExportArtifacts;
  shareEnabled?: boolean;
  /** Async — returns once URLs are copied. Errors surface inline. */
  onShare?: (artifacts: ExportArtifacts) => Promise<void>;
  /** Capture artifacts on first click when the Export section has not run yet. */
  onEnsureArtifacts?: () => Promise<ExportArtifacts | null | undefined>;
  /** v2.7.6 — when true every action button is disabled (no capture yet). */
  disabled?: boolean;
  /** v2.7.10 — user-supplied base file name (without extension). */
  customBaseName?: string;
}

function tsNow(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function safeDomain(d: string): string {
  return (d || "page").replace(/^www\./, "").replace(/[^a-z0-9_-]+/gi, "_");
}

/**
 * Trigger from the panel DOM. This avoids the MV3 `chrome.downloads.download`
 * Save As flake where the background worker can acknowledge but never start
 * a visible download on some Chrome settings.
 */
async function triggerDownload(blob: Blob, filename: string): Promise<string | undefined> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  (document.body ?? document.documentElement).appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

function flowSlug(f: ExportFlow): string {
  return f === ExportFlow.FullPage ? "fullpage" : "element";
}

function fileBaseName(a: ExportArtifacts): string {
  return `inspect-page-${flowSlug(a.flow)}-${safeDomain(a.domain)}-${tsNow()}`;
}

/** Build the single-file MD: AI block + inlined html/css/js fences + base64 images. */
function buildSingleMd(a: ExportArtifacts, addons: ColorTokenAddons): string {
  const ai = buildPromptMd(a, { mode: "single" });
  const parts: string[] = [ai, ""];
  if (a.prelude) parts.push(a.prelude, "");
  if (addons.mdBlock) parts.push(addons.mdBlock, "");
  parts.push("## HTML", "", "```html", a.html || "", "```", "");
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

function buildMdFilesMd(a: ExportArtifacts, addons: ColorTokenAddons): string {
  const ai = buildPromptMd(a, { mode: "mdFiles" });
  const prelude = a.prelude ? `\n\n${a.prelude}` : "";
  const tokens = addons.mdBlock ? `\n\n${addons.mdBlock}` : "";
  const tail = addons.tokensCss || addons.selectorsCss
    ? `, plus \`./tokens.css\` and \`./selectors.css\` for the v2 color tokens`
    : "";
  return `${ai}${prelude}${tokens}\n\n_See \`./index.html\`, \`./style.css\`, and the \`./images/\` folder for the captured assets${tail}._\n`;
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
  onEnsureArtifacts,
  disabled = false,
  customBaseName,
}: ExportModesProps): JSX.Element {
  const [shareState, setShareState] = useState<
    | { phase: "idle" }
    | { phase: "uploading" }
    | { phase: "done"; expiresAt: number }
    | { phase: "error"; message: string }
  >({ phase: "idle" });
  const [now, setNow] = useState<number>(Date.now());
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);
  const [addons, setAddons] = useState<ColorTokenAddons>(emptyColorTokenAddons);

  // Pull addons from the most-recent Inspect snapshot when one exists.
  const snap = useMemo<InspectSnapshot | null>(() => {
    const c = snapshotCache.get();
    return c ? (asInspectSnapshot(c.data.snapshot) ?? null) : null;
  }, []);
  useEffect(() => {
    if (!snap) { setAddons(emptyColorTokenAddons()); return; }
    let isAborted = false;
    void loadColorTokenAddons(snap).then((a) => { if (!isAborted) setAddons(a); });
    return () => { isAborted = true; };
  }, [snap]);

  useEffect(() => {
    if (shareState.phase !== "done") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [shareState.phase]);

  const resolveArtifacts = useCallback(async (): Promise<ExportArtifacts | null> => {
    if (!disabled) return artifacts;
    return (await onEnsureArtifacts?.()) ?? null;
  }, [artifacts, disabled, onEnsureArtifacts]);

  const baseName = (a: ExportArtifacts, suffix?: string): string => {
    const base = customBaseName?.trim() || fileBaseName(a);
    return suffix ? `${base}-${suffix}` : base;
  };

  const onMd = useCallback(async () => {
    const current = await resolveArtifacts();
    if (!current) return;
    const md = buildSingleMd(current, addons);
    const saved = await triggerDownload(
      new Blob([md], { type: "text/markdown;charset=utf-8" }),
      `${baseName(current)}.md`,
    );
    if (saved) setLastSavedPath(saved);
  }, [resolveArtifacts, addons, customBaseName]);

  const handleShare = useCallback(async () => {
    if (!onShare) return;
    const current = await resolveArtifacts();
    if (!current) return;
    setShareState({ phase: "uploading" });
    try {
      // Bake the token CSS into the shared payload so the four hosted
      // pages get the same `var(--ip-color-…)` system as ZIP downloads.
      const augmented = withAddonsBakedIn(current, addons);
      await onShare(augmented);
      // Best-effort: extract expires_at via a side channel — onShare hides
      // it. We approximate 24h from now for the chip.
      setShareState({ phase: "done", expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    } catch (e) {
      setShareState({
        phase: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [resolveArtifacts, onShare, addons]);

  const onMdFiles = useCallback(async () => {
    const current = await resolveArtifacts();
    if (!current) return;
    const zip = new JSZip();
    zip.file("prompt.md", buildMdFilesMd(current, addons));
    if (current.html) zip.file("index.html", current.html);
    if (current.css) zip.file("style.css", current.css);
    if (addons.tokensCss)    zip.file("tokens.css", addons.tokensCss);
    if (addons.selectorsCss) zip.file("selectors.css", addons.selectorsCss);
    for (const img of current.images) {
      zip.file(`images/${img.name}`, base64ToUint8(img.base64));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const saved = await triggerDownload(blob, `${baseName(current, "mdfiles")}.zip`);
    if (saved) setLastSavedPath(saved);
  }, [resolveArtifacts, addons, customBaseName]);

  const onZip = useCallback(async () => {
    const current = await resolveArtifacts();
    if (!current) return;
    const zip = new JSZip();
    const preludeBits = [current.prelude, addons.mdBlock].filter(Boolean).join("\n\n");
    const zipPrompt = preludeBits
      ? `${buildPromptMd(current, { mode: "zip" })}\n\n${preludeBits}`
      : buildPromptMd(current, { mode: "zip" });
    zip.file("prompt.md", zipPrompt);
    if (current.html) zip.file("index.html", current.html);
    if (current.css) zip.file("style.css", current.css);
    if (current.js) zip.file("script.js", current.js);
    if (addons.tokensCss)    zip.file("tokens.css", addons.tokensCss);
    if (addons.selectorsCss) zip.file("selectors.css", addons.selectorsCss);
    for (const img of current.images) {
      zip.file(`images/${img.name}`, base64ToUint8(img.base64));
    }
    zip.file("manifest.json", `${JSON.stringify(current.meta, null, 2)}\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    const saved = await triggerDownload(blob, `${baseName(current)}.zip`);
    if (saved) setLastSavedPath(saved);
  }, [resolveArtifacts, addons, customBaseName]);

  return (
    <div className="lpe-export-modes" aria-label={COPY.exportModesHeader}>
      <div className="lpe-debug-title">{COPY.exportModesHeader}</div>
      <div className="lpe-debug-actions">
        <button type="button" className="lpe-btn" onClick={onMd} disabled={disabled && !onEnsureArtifacts}>
          {COPY.exportModeMd}
        </button>
        <button type="button" className="lpe-btn" onClick={onMdFiles} disabled={disabled && !onEnsureArtifacts}>
          {COPY.exportModeMdFiles}
        </button>
        <button type="button" className="lpe-btn lpe-btn-primary" onClick={onZip} disabled={disabled && !onEnsureArtifacts}>
          {COPY.exportModeZip}
        </button>
        <button
          type="button"
          className="lpe-btn"
          onClick={handleShare}
          disabled={(disabled && !onEnsureArtifacts) || !shareEnabled || shareState.phase === "uploading"}
          title={shareEnabled ? undefined : COPY.exportModeShareDisabledTip}
        >
          {shareState.phase === "uploading" ? COPY.shareUploading : COPY.exportModeShare}
        </button>
      </div>
      {shareState.phase === "done" && (
        <div className="lpe-debug-note">
          ✓ {COPY.shareCopied} · {COPY.shareExpiresInPrefix} {formatRemaining(shareState.expiresAt - now)}
        </div>
      )}
      {shareState.phase === "error" && (
        <div className="lpe-debug-note" role="alert">⚠ {shareState.message}</div>
      )}
      {lastSavedPath && (
        <div className="lpe-debug-note" title={lastSavedPath}>
          ✓ Saved to: <code>{lastSavedPath}</code>
        </div>
      )}
    </div>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Append the v2 color-token CSS + per-selector CSS to the shared artifact's
 * stylesheet so Smart Share's four hosted pages display them inline.
 */
function withAddonsBakedIn(a: ExportArtifacts, addons: ColorTokenAddons): ExportArtifacts {
  if (!addons.tokensCss && !addons.selectorsCss) return a;
  const segments: string[] = [];
  if (a.css) segments.push(a.css);
  if (addons.tokensCss)    segments.push(`/* === Color tokens === */\n${addons.tokensCss}`);
  if (addons.selectorsCss) segments.push(`/* === Per-selector tokens === */\n${addons.selectorsCss}`);
  return { ...a, css: segments.join("\n\n") };
}