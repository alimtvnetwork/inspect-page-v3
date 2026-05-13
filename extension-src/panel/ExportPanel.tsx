/**
 * Shared <ExportPanel/> rendered by both the popup and the floating in-page panel.
 * Source: spec/21-app/02-ui-panel.md.
 *
 * Stage 3 scope:
 *   - Renders Idle / Capturing / PickerActive / Error / Success states.
 *   - Loads + saves Settings via SW (GetSettings / SetSettings).
 *   - Detects "Not available here" pages (chrome://, edge://, file:// when blocked).
 *   - "Export Full Page" / "Pick Element" buttons fire actions but the SW
 *     handlers for RunFullPageExport / EnterPickerMode arrive in later stages.
 *     For now, clicking them shows an Error if the handler is missing — by design.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@shared/copy";
import { INSPECT_PAGE_WP_SITE_URL, SUCCESS_AUTO_DISMISS_MS } from "@shared/constants";
import { ErrorCode, MessageKind, PanelStatus } from "@shared/enums";
import { MessageError, sendToBackground } from "@shared/messaging";
import type {
  GetSettingsResponse,
  ExportMeta,
  Settings,
  StatusUpdatePayload,
  ShareSettings,
  CreateShareSessionResponse,
  ExportArtifacts,
} from "@shared/types";
import { format } from "./format";
import { telemetryRows } from "./telemetry";
import JSZip from "jszip";
import { ExportFlow } from "@shared/enums";
import { ExportModes } from "./ExportModes";
import { interpolateAi } from "@shared/copy";
import { MessageKind as MK } from "@shared/enums";

export type PanelSurface = "popup" | "floating";

export interface ExportPanelProps {
  surface: PanelSurface;
  /** URL of the active tab; used to detect disabled origins. */
  activeUrl?: string;
  /** Tab id; used by later stages for full-page / picker dispatch. */
  activeTabId?: number;
  /** Floating-panel only: drag handle / minimize / close hooks. */
  onMinimize?: () => void;
  onClose?: () => void;
}

interface PanelState {
  status: PanelStatus;
  message?: string;
  errorCode?: ErrorCode;
  errorDetail?: string;
  progress?: { done: number; total: number };
  successFilename?: string;
  /** v1.1: counts surfaced to the user after a successful Full Page export. */
  successTelemetry?: ExportMeta["counts"];
  /** When set, "Retry" reruns this kind. */
  lastAction?: "fullPage" | "pick";
  /** v1.2: in-panel debug preview for the picked element. */
  debugPreview?: NonNullable<StatusUpdatePayload["debugPreview"]>;
  /** v1.3: artifacts returned by a successful Full Page export. */
  fullPageArtifacts?: {
    html: string;
    css: string;
    js: string;
    screenshotDataUrl: string;
    meta: ExportMeta;
  };
}

const DISABLED_PREFIXES = ["chrome://", "edge://", "about:", "chrome-extension://", "view-source:"];

function isDisabledUrl(url?: string): boolean {
  if (!url) return false;
  return DISABLED_PREFIXES.some((p) => url.startsWith(p));
}

function statusLabel(s: PanelState): string {
  switch (s.status) {
    case PanelStatus.Idle: return COPY.statusIdle;
    case PanelStatus.Collecting: return COPY.statusCollecting;
    case PanelStatus.Capturing:
      return format(COPY.statusCapturing, {
        done: s.progress?.done ?? 0,
        total: s.progress?.total ?? 0,
      });
    case PanelStatus.Stitching: return COPY.statusStitching;
    case PanelStatus.Bundling: return COPY.statusBundling;
    case PanelStatus.Downloading: return COPY.statusDownloading;
    case PanelStatus.PickerActive: return COPY.statusPicker;
    case PanelStatus.Selecting: return COPY.statusSelecting;
    case PanelStatus.Success: return format(COPY.statusSuccess, { filename: s.successFilename ?? "" });
    case PanelStatus.Error:
      return format(COPY.statusError, { message: s.message ?? "", code: s.errorCode ?? "" });
  }
}

const BUSY_STATUSES: ReadonlySet<PanelStatus> = new Set([
  PanelStatus.Collecting, PanelStatus.Capturing, PanelStatus.Stitching,
  PanelStatus.Bundling, PanelStatus.Downloading,
  PanelStatus.PickerActive, PanelStatus.Selecting,
]);

export function ExportPanel(props: ExportPanelProps): JSX.Element {
  const { surface, activeUrl, activeTabId, onMinimize, onClose } = props;
  const [state, setState] = useState<PanelState>({ status: PanelStatus.Idle });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [shareSettings, setShareSettingsState] = useState<ShareSettings | null>(null);
  const [shareResult, setShareResult] = useState<CreateShareSessionResponse | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disabled = isDisabledUrl(activeUrl);

  // ---- Load settings on mount ----
  useEffect(() => {
    let alive = true;
    sendToBackground<Record<string, never>, GetSettingsResponse>(MessageKind.GetSettings, {})
      .then((s) => { if (alive) setSettings(s); })
      .catch((e: unknown) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        setSettingsError(msg);
      });
    return () => { alive = false; };
  }, []);

  // ---- Load Share Links credentials ----
  useEffect(() => {
    let alive = true;
    sendToBackground<Record<string, never>, ShareSettings>(MessageKind.GetShareSettings, {})
      .then((s) => { if (alive) setShareSettingsState(s); })
      .catch(() => { /* non-fatal */ });
    return () => { alive = false; };
  }, []);

  // ---- Listen for StatusUpdate broadcasts from SW (stages 5+) ----
  useEffect(() => {
    const handlePayload = (p: StatusUpdatePayload): void => {
      setState((prev) => ({
        ...prev,
        status: p.status,
        message: p.message ?? prev.message,
        progress: p.progress,
        ...(p.status === PanelStatus.Error
          ? { errorCode: p.errorCode, errorDetail: p.errorDetail }
          : {}),
        ...(p.debugPreview ? { debugPreview: p.debugPreview } : {}),
        ...(p.status === PanelStatus.Success && p.telemetry
          ? { successTelemetry: p.telemetry }
          : {}),
        ...(p.status === PanelStatus.Success && p.message
          ? { successFilename: p.message }
          : {}),
      }));
    };
    const runtimeListener = (raw: unknown): void => {
      if (typeof raw !== "object" || raw === null) return;
      const env = raw as { kind?: string; payload?: unknown };
      if (env.kind !== MessageKind.StatusUpdate) return;
      handlePayload(env.payload as StatusUpdatePayload);
    };
    // Local in-page bus — required for the floating panel because Chrome
    // does not deliver runtime messages back to the originating content-
    // script context.
    const winListener = (e: Event): void => {
      const ce = e as CustomEvent<StatusUpdatePayload>;
      if (ce.detail) handlePayload(ce.detail);
    };
    chrome?.runtime?.onMessage?.addListener?.(runtimeListener as never);
    window.addEventListener("inspect-page:status", winListener as EventListener);
    return () => {
      chrome?.runtime?.onMessage?.removeListener?.(runtimeListener as never);
      window.removeEventListener("inspect-page:status", winListener as EventListener);
    };
  }, []);

  // ---- Auto-dismiss Success ----
  useEffect(() => {
    if (state.status !== PanelStatus.Success) return;
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => {
      setState({ status: PanelStatus.Idle });
    }, SUCCESS_AUTO_DISMISS_MS);
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [state.status]);

  // ---- Action handlers ----
  const runAction = useCallback(async (kind: "fullPage" | "pick") => {
    if (disabled) return;
    // Floating panel doesn't know its own tabId — SW resolves via sender.tab.id
    // when we send -1.
    const tid = activeTabId ?? -1;
    setState({ status: PanelStatus.Collecting, lastAction: kind });
    try {
      if (kind === "fullPage") {
        const res = await sendToBackground<
          { tabId: number; settings: Settings },
          {
            bundleFilename: string;
            downloadId: number;
            telemetry?: ExportMeta["counts"];
            artifacts?: {
              html: string;
              css: string;
              js: string;
              screenshotDataUrl: string;
              meta: ExportMeta;
            };
          }
        >(
          MessageKind.RunFullPageExport,
          { tabId: tid, settings: settings! },
        );
        setState({
          status: PanelStatus.Success,
          successFilename: res.bundleFilename,
          successTelemetry: res.telemetry,
          fullPageArtifacts: res.artifacts,
          lastAction: kind,
        });
      } else {
        await sendToBackground<{ tabId: number }, void>(
          MessageKind.EnterPickerMode,
          { tabId: tid },
        );
        setState({ status: PanelStatus.PickerActive, lastAction: kind });
      }
    } catch (err) {
      const me = err instanceof MessageError ? err : null;
      setState({
        status: PanelStatus.Error,
        message: me?.message ?? (err instanceof Error ? err.message : String(err)),
        errorCode: me?.code,
        errorDetail: me?.detail,
        lastAction: kind,
      });
    }
  }, [disabled, activeTabId, settings]);

  const onFullPage = useCallback(() => void runAction("fullPage"), [runAction]);
  const onPick = useCallback(() => void runAction("pick"), [runAction]);

  const onCancel = useCallback(async () => {
    if (state.lastAction === "pick") {
      try {
        await sendToBackground<{ tabId: number }, void>(
          MessageKind.ExitPickerMode, { tabId: activeTabId ?? -1 },
        );
      } catch {
        // best effort
      }
    }
    setState({ status: PanelStatus.Idle });
  }, [activeTabId, state.lastAction]);

  const onRetry = useCallback(() => {
    if (state.lastAction) void runAction(state.lastAction);
  }, [runAction, state.lastAction]);

  const onCopyDetails = useCallback(async () => {
    const text = JSON.stringify({
      code: state.errorCode, message: state.message, detail: state.errorDetail,
    }, null, 2);
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }, [state.errorCode, state.message, state.errorDetail]);

  const onSettingsPatch = useCallback(async (patch: Partial<Settings>) => {
    try {
      const next = await sendToBackground<Partial<Settings>, Settings>(MessageKind.SetSettings, patch);
      setSettings(next);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onShareSettingsPatch = useCallback(async (patch: Partial<ShareSettings>) => {
    try {
      const next = await sendToBackground<Partial<ShareSettings>, ShareSettings>(
        MessageKind.SetShareSettings, patch,
      );
      setShareSettingsState(next);
    } catch { /* ignore */ }
  }, []);

  const onShare = useCallback(async (artifacts: ExportArtifacts): Promise<void> => {
    const primary = artifacts.images[0];
    if (!primary) {
      throw new Error("No image to upload — Share Links requires a screenshot.");
    }
    const res = await sendToBackground<
      {
        kind: string; sourceUrl: string;
        html: string; css: string; js: string;
        imageBase64: string; imageMime: string;
      },
      CreateShareSessionResponse
    >(MessageKind.CreateShareSession, {
      kind: artifacts.flow,
      sourceUrl: activeUrl ?? artifacts.meta?.url ?? "",
      html: artifacts.html,
      css: artifacts.css,
      js: artifacts.js,
      imageBase64: primary.base64,
      imageMime: primary.mime,
    });
    setShareResult(res);
    return;
  }, [activeUrl]);

  const onOpenFloating = useCallback(async () => {
    if (activeTabId === undefined) return;
    try {
      await sendToBackground<{ tabId: number }, void>(MessageKind.MountFloatingPanel, { tabId: activeTabId });
      window.close();
    } catch (err) {
      const me = err instanceof MessageError ? err : null;
      setState({
        status: PanelStatus.Error,
        message: me?.message ?? (err instanceof Error ? err.message : String(err)),
        errorCode: me?.code,
      });
    }
  }, [activeTabId]);

  const busy = useMemo(() => BUSY_STATUSES.has(state.status), [state.status]);

  return (
    <div className="lpe-root" role="region" aria-label={COPY.appName}>
      <header
        className="lpe-header"
        data-draggable={surface === "floating" ? "true" : "false"}
        data-drag-handle={surface === "floating" ? "true" : undefined}
      >
        <span aria-hidden="true">≡</span>
        <span className="lpe-header-title">{COPY.appName}</span>
        {surface === "floating" && (
          <>
            <button type="button" className="lpe-header-btn" onClick={onMinimize} aria-label={COPY.btnMinimize}>─</button>
            <button type="button" className="lpe-header-btn" onClick={onClose} aria-label={COPY.btnClose}>✕</button>
          </>
        )}
      </header>

      <div className="lpe-body">
        {disabled ? (
          <div className="lpe-not-available" role="alert">{COPY.notAvailable}</div>
        ) : (
          <>
            <button
              type="button"
              className="lpe-btn lpe-btn-primary"
              onClick={onFullPage}
              disabled={busy || settings === null}
            >
              {COPY.btnFullPage}
            </button>
            <button
              type="button"
              className="lpe-btn"
              onClick={onPick}
              disabled={busy || settings === null}
            >
              {COPY.btnPick}
            </button>
            {surface === "popup" && (
              <button
                type="button"
                className="lpe-btn"
                onClick={onOpenFloating}
                disabled={busy}
              >
                {COPY.btnOpenPanel}
              </button>
            )}
          </>
        )}

        <div
          className="lpe-status"
          data-status={state.status}
          role="status"
          aria-live="polite"
        >
          {statusLabel(state)}
          {state.status === PanelStatus.Capturing && state.progress && (
            <div className="lpe-progress" aria-hidden="true">
              <div
                className="lpe-progress-bar"
                style={{ width: `${(state.progress.done / Math.max(1, state.progress.total)) * 100}%` }}
              />
            </div>
          )}
          {busy && state.status !== PanelStatus.PickerActive && (
            <div style={{ marginTop: 6 }}>
              <button type="button" className="lpe-btn" onClick={onCancel}>{COPY.btnCancel}</button>
            </div>
          )}
          {state.status === PanelStatus.PickerActive && (
            <div style={{ marginTop: 6 }}>
              <button type="button" className="lpe-btn" onClick={onCancel}>{COPY.btnCancelPicker}</button>
            </div>
          )}
          {state.status === PanelStatus.Error && (
            <div className="lpe-row" style={{ marginTop: 8 }}>
              <button type="button" className="lpe-btn" onClick={onCopyDetails}>{COPY.btnCopyDetails}</button>
              <button type="button" className="lpe-btn lpe-btn-primary" onClick={onRetry}>{COPY.btnRetry}</button>
            </div>
          )}
          {state.status === PanelStatus.Success && state.successTelemetry && (
            <TelemetrySummary counts={state.successTelemetry} />
          )}
          {state.status === PanelStatus.Success && state.fullPageArtifacts && (
            <FullPageActions
              artifacts={state.fullPageArtifacts}
              activeUrl={activeUrl}
              shareEnabled={!!shareSettings && !!shareSettings.nonce && !!shareSettings.siteUrl}
              onShare={onShare}
            />
          )}
        </div>

        {state.debugPreview && (
          <DebugPreview
            preview={state.debugPreview}
            activeUrl={activeUrl}
            shareEnabled={!!shareSettings && !!shareSettings.nonce && !!shareSettings.siteUrl}
            onShare={onShare}
            onClear={() => setState((s) => ({ ...s, debugPreview: undefined }))}
          />
        )}

        {settings && !disabled && (
          <SettingsSection
            settings={settings}
            error={settingsError}
            onPatch={onSettingsPatch}
          />
        )}

        {shareSettings && !disabled && (
          <ShareSettingsSection
            settings={shareSettings}
            onPatch={onShareSettingsPatch}
          />
        )}
      </div>
      {shareResult && (
        <ShareDialog
          result={shareResult}
          onClose={() => setShareResult(null)}
        />
      )}
    </div>
  );
}

interface SettingsSectionProps {
  settings: Settings;
  error: string | null;
  onPatch: (patch: Partial<Settings>) => void;
}

function SettingsSection({ settings, error, onPatch }: SettingsSectionProps): JSX.Element {
  return (
    <details className="lpe-settings">
      <summary>{COPY.settingsHeader}</summary>
      <div className="lpe-settings-body">
        {error && <div className="lpe-not-available" role="alert">{error}</div>}

        <div className="lpe-field">
          <label htmlFor="lpe-format">{COPY.lblImageFormat}</label>
          <select
            id="lpe-format"
            className="lpe-select"
            value={settings.imageFormat}
            onChange={(e) => onPatch({ imageFormat: e.target.value as Settings["imageFormat"] })}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>

        {settings.imageFormat === "jpeg" && (
          <div className="lpe-field">
            <label htmlFor="lpe-quality">{COPY.lblJpegQuality}: {settings.jpegQuality}</label>
            <input
              id="lpe-quality"
              type="range"
              min={60}
              max={100}
              value={settings.jpegQuality}
              onChange={(e) => onPatch({ jpegQuality: Number(e.target.value) })}
            />
          </div>
        )}

        <label className="lpe-field-row">
          <input
            type="checkbox"
            checked={settings.redactPasswordFields}
            onChange={(e) => onPatch({ redactPasswordFields: e.target.checked })}
          />
          <span>{COPY.lblRedact}</span>
        </label>

        <label className="lpe-field-row">
          <input
            type="checkbox"
            checked={settings.includeComputedStyles}
            onChange={(e) => onPatch({ includeComputedStyles: e.target.checked })}
          />
          <span>{COPY.lblComputed}</span>
        </label>

        <label className="lpe-field-row">
          <input
            type="checkbox"
            checked={settings.includeMatchedRules}
            onChange={(e) => onPatch({ includeMatchedRules: e.target.checked })}
          />
          <span>{COPY.lblMatched}</span>
        </label>

        <div className="lpe-field">
          <label htmlFor="lpe-name-full">{COPY.lblNameFull}</label>
          <input
            id="lpe-name-full"
            className="lpe-input"
            value={settings.namingTemplateFullPage}
            onChange={(e) => onPatch({ namingTemplateFullPage: e.target.value })}
          />
        </div>

        <div className="lpe-field">
          <label htmlFor="lpe-name-elem">{COPY.lblNameElem}</label>
          <input
            id="lpe-name-elem"
            className="lpe-input"
            value={settings.namingTemplateElement}
            onChange={(e) => onPatch({ namingTemplateElement: e.target.value })}
          />
        </div>
      </div>
    </details>
  );
}

interface TelemetrySummaryProps {
  counts: NonNullable<PanelState["successTelemetry"]>;
}

/**
 * Compact "what was captured" block shown after a successful Full Page
 * export. Only renders rows whose count is meaningful (non-zero) so a
 * minimal page produces a minimal block.
 */
function TelemetrySummary({ counts }: TelemetrySummaryProps): JSX.Element | null {
  const rows = telemetryRows(counts);
  if (rows.length === 0) return null;
  return (
    <div className="lpe-telemetry" aria-label={COPY.telemetryHeader}>
      <div className="lpe-telemetry-header">{COPY.telemetryHeader}</div>
      <ul className="lpe-telemetry-list">
        {rows.map(([label, value]) => (
          <li key={label} className="lpe-telemetry-row">
            <span className="lpe-telemetry-label">{label}</span>
            <span className="lpe-telemetry-value">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface DebugPreviewProps {
  preview: NonNullable<StatusUpdatePayload["debugPreview"]>;
  activeUrl?: string;
  shareEnabled?: boolean;
  onShare?: (artifacts: ExportArtifacts) => Promise<void>;
  onClear: () => void;
}

function DebugPreview({ preview, activeUrl, shareEnabled, onShare, onClear }: DebugPreviewProps): JSX.Element {
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

function deriveDomain(url: string | undefined): string {
  if (!url) return "page";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "page";
  }
}

function buildElementArtifacts(
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

interface FullPageActionsProps {
  artifacts: NonNullable<PanelState["fullPageArtifacts"]>;
  activeUrl?: string;
  shareEnabled?: boolean;
  onShare?: (artifacts: ExportArtifacts) => Promise<void>;
}

function FullPageActions({ artifacts, activeUrl, shareEnabled, onShare }: FullPageActionsProps): JSX.Element {
  const [fmt, setFmt] = useState<"raw" | "md">("raw");

  const domainSafe = (): string => {
    try {
      const u = new URL(artifacts.meta.url);
      return u.hostname.replace(/^www\./, "").replace(/[^a-z0-9_-]+/gi, "_");
    } catch {
      return "page";
    }
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
  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> =>
    (await fetch(dataUrl)).blob();
  const fenceFor = (k: "html" | "css" | "js"): string =>
    k === "js" ? "javascript" : k;
  const buildSingleMd = (k: "html" | "css" | "js"): string =>
    `# Page — ${artifacts.meta.url}\n\n## ${k.toUpperCase()}\n\n\`\`\`${fenceFor(k)}\n${artifacts[k] || ""}\n\`\`\`\n`;
  const buildCombinedMd = (): string =>
    `# Page — ${artifacts.meta.url}\n\n_Captured ${artifacts.meta.capturedAtIso}_\n\n## HTML\n\n\`\`\`html\n${artifacts.html}\n\`\`\`\n\n## CSS\n\n\`\`\`css\n${artifacts.css}\n\`\`\`\n\n## JS\n\n\`\`\`javascript\n${artifacts.js}\n\`\`\`\n`;

  const onDownloadOne = useCallback((k: "html" | "css" | "js") => {
    const safe = domainSafe();
    const ts = tsNow();
    if (fmt === "md") {
      triggerDownload(
        new Blob([buildSingleMd(k)], { type: "text/markdown;charset=utf-8" }),
        `inspect-page-fullpage-${safe}-${k}-${ts}.md`,
      );
    } else {
      const mime =
        k === "html" ? "text/html"
        : k === "css" ? "text/css"
        : "text/javascript";
      triggerDownload(
        new Blob([artifacts[k] || ""], { type: `${mime};charset=utf-8` }),
        `inspect-page-fullpage-${safe}-${ts}.${k}`,
      );
    }
  }, [artifacts, fmt]);

  const onDownloadScreenshot = useCallback(async () => {
    try {
      const blob = await dataUrlToBlob(artifacts.screenshotDataUrl);
      const ext = blob.type.includes("jpeg") ? "jpg" : "png";
      triggerDownload(blob, `inspect-page-fullpage-${domainSafe()}-${tsNow()}.${ext}`);
    } catch { /* ignore */ }
  }, [artifacts]);

  const onDownloadAll = useCallback(async () => {
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
      triggerDownload(blob, `inspect-page-fullpage-${safe}-${ts}.zip`);
    } catch { /* ignore */ }
  }, [artifacts, fmt]);

  return (
    <div className="lpe-debug" aria-label={COPY.fullPageActionsHeader}>
      <div className="lpe-debug-header">
        <span className="lpe-debug-title">{COPY.fullPageActionsHeader}</span>
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
        <button type="button" className="lpe-btn" onClick={() => onDownloadOne("html")}>
          {COPY.fullPageDownloadHtml}
        </button>
        <button type="button" className="lpe-btn" onClick={() => onDownloadOne("css")}>
          {COPY.fullPageDownloadCss}
        </button>
        <button type="button" className="lpe-btn" onClick={() => onDownloadOne("js")}>
          {COPY.fullPageDownloadJs}
        </button>
        <button type="button" className="lpe-btn" onClick={onDownloadScreenshot}>
          {COPY.fullPageDownloadScreenshot}
        </button>
        <button type="button" className="lpe-btn lpe-btn-primary" onClick={onDownloadAll}>
          {COPY.fullPageDownloadAllZip}
        </button>
      </div>
      <ExportModes
        artifacts={buildFullPageArtifacts(artifacts, activeUrl)}
        shareEnabled={shareEnabled}
        onShare={onShare}
      />
    </div>
  );
}

function buildFullPageArtifacts(
  src: NonNullable<PanelState["fullPageArtifacts"]>,
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

interface ShareSettingsSectionProps {
  settings: ShareSettings;
  onPatch: (patch: Partial<ShareSettings>) => void;
}

function ShareSettingsSection({ settings, onPatch }: ShareSettingsSectionProps): JSX.Element {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [quota, setQuota] = useState<{
    lifetimeUsed: number; freeLimit: number; hasLicense: boolean;
  } | null>(null);
  const siteUrl = INSPECT_PAGE_WP_SITE_URL;
  const configured = !!siteUrl;
  const signedIn = configured && !!settings.nonce && !!settings.userId;

  const onSignIn = async (): Promise<void> => {
    if (!configured) { setErr(COPY.shareNotConfiguredMsg); return; }
    setErr("");
    try {
      await sendToBackground<{ siteUrl: string }, void>(MK.OpenLoginPopup, { siteUrl });
      setHint(COPY.shareLoginOpenedMsg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const onRefresh = async (): Promise<void> => {
    if (!configured) { setErr(COPY.shareNotConfiguredMsg); return; }
    setBusy(true); setErr(""); setHint("");
    try {
      const r = await sendToBackground<Record<string, never>, {
        loggedIn: boolean; userId: number; displayName: string; email: string; nonce: string;
        quota?: {
          active: number; maxActive: number; hourlyUsed: number; maxHourly: number;
          lifetimeUsed: number; freeLimit: number; hasLicense: boolean;
        };
      }>(MK.CheckShareAuth, {});
      if (!r.loggedIn) {
        setErr(COPY.shareSignedOutMsg);
        setQuota(null);
      } else {
        // Patch already persisted by SW — refresh local view via parent.
        onPatch({
          userId: r.userId, displayName: r.displayName,
          email: r.email, nonce: r.nonce,
          signedInAtIso: new Date().toISOString(),
        });
        if (r.quota) setQuota({
          lifetimeUsed: r.quota.lifetimeUsed,
          freeLimit: r.quota.freeLimit,
          hasLicense: r.quota.hasLicense,
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const onSignOut = (): void => {
    onPatch({ userId: 0, displayName: "", email: "", nonce: "", signedInAtIso: "" });
    setQuota(null);
  };

  // Auto-fetch quota when signed in and not yet loaded.
  useEffect(() => {
    if (!signedIn || quota) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await sendToBackground<Record<string, never>, {
          loggedIn: boolean;
          quota?: {
            active: number; maxActive: number; hourlyUsed: number; maxHourly: number;
            lifetimeUsed: number; freeLimit: number; hasLicense: boolean;
          };
        }>(MK.CheckShareAuth, {});
        if (!cancelled && r.loggedIn && r.quota) {
          setQuota({
            lifetimeUsed: r.quota.lifetimeUsed,
            freeLimit: r.quota.freeLimit,
            hasLicense: r.quota.hasLicense,
          });
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [signedIn, quota]);

  return (
    <details className="lpe-settings">
      <summary>{COPY.shareSettingsHeader}</summary>
      <div className="lpe-settings-body">
        {!configured ? (
          <div className="lpe-debug-note" role="status">
            {COPY.shareNotConfiguredMsg}
          </div>
        ) : signedIn ? (
          <div className="lpe-field">
            <div>
              {COPY.shareSignedInAsPrefix}{" "}
              <strong>{settings.displayName || settings.email}</strong>
            </div>
            {quota && (
              <div className="lpe-debug-note" role="status">
                {quota.hasLicense
                  ? COPY.shareQuotaUnlimited
                  : `${COPY.shareQuotaPrefix} ${quota.lifetimeUsed} / ${quota.freeLimit}`}
                {!quota.hasLicense && quota.lifetimeUsed >= quota.freeLimit && (
                  <div style={{ marginTop: 4 }}><em>{COPY.shareUpgradeHint}</em></div>
                )}
              </div>
            )}
            <button type="button" className="lpe-btn" onClick={onSignOut}>
              {COPY.shareSignOutBtn}
            </button>
          </div>
        ) : (
          <div className="lpe-field">
            <button type="button" className="lpe-btn lpe-btn-primary" onClick={onSignIn}>
              {COPY.shareSignInBtn}
            </button>
            <button type="button" className="lpe-btn" onClick={onRefresh} disabled={busy}>
              {busy ? "…" : COPY.shareCheckBtn}
            </button>
          </div>
        )}
        {hint && <div className="lpe-debug-note">{hint}</div>}
        {err && <div className="lpe-debug-note" role="alert">{err}</div>}
        <div className="lpe-debug-note">{COPY.shareHelp}</div>
      </div>
    </details>
  );
}

interface ShareDialogProps {
  result: CreateShareSessionResponse;
  onClose: () => void;
}

function ShareDialog({ result, onClose }: ShareDialogProps): JSX.Element {
  const expiresAtMs = useMemo(() => {
    const t = Date.parse(result.expiresAt);
    return Number.isFinite(t) ? t : Date.now();
  }, [result.expiresAt]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, expiresAtMs - now);
  const expired = remainingMs === 0;

  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [revokeErr, setRevokeErr] = useState("");
  const [copiedKey, setCopiedKey] = useState<string>("");

  const block = useMemo(() => interpolateAi({
    htmlRef: result.urls.html, cssRef: result.urls.css,
    jsRef: result.urls.js, imageRef: result.urls.image,
  }), [result]);

  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); }
    catch { /* ignore */ }
    window.setTimeout(() => setCopiedKey((k) => (k === key ? "" : k)), 1500);
  }, []);

  const onRevoke = useCallback(async () => {
    setRevoking(true); setRevokeErr("");
    try {
      await sendToBackground<{ sessionId: string }, void>(
        MK.RevokeShareSession, { sessionId: result.sessionId },
      );
      setRevoked(true);
    } catch (e) {
      setRevokeErr(e instanceof Error ? e.message : String(e));
    } finally { setRevoking(false); }
  }, [result.sessionId]);

  const rows: Array<{ key: keyof CreateShareSessionResponse["urls"]; label: string }> = [
    { key: "html",  label: COPY.shareLblHtml },
    { key: "css",   label: COPY.shareLblCss },
    { key: "js",    label: COPY.shareLblJs },
    { key: "image", label: COPY.shareLblImage },
  ];

  return (
    <div className="lpe-modal-overlay" role="dialog" aria-modal="true" aria-label={COPY.shareDialogHeader}>
      <div className="lpe-modal">
        <div className="lpe-modal-header">
          <span className="lpe-debug-title">{COPY.shareDialogHeader}</span>
          <button type="button" className="lpe-header-btn" onClick={onClose} aria-label={COPY.shareCloseBtn}>✕</button>
        </div>
        <div className="lpe-modal-body">
          <div className="lpe-debug-note" style={{ background: "transparent" }}>
            {COPY.shareDialogIntro}
          </div>
          <div className="lpe-share-countdown" data-expired={expired ? "true" : "false"}>
            {expired
              ? COPY.shareExpiredMsg
              : `${COPY.shareExpiresInPrefix} ${formatRemaining(remainingMs)}`}
          </div>
          {revoked && <div className="lpe-debug-note" role="status">{COPY.shareRevokedMsg}</div>}
          <ul className="lpe-share-urls">
            {rows.map(({ key, label }) => (
              <li key={key} className="lpe-share-url-row">
                <span className="lpe-share-url-label">{label}</span>
                <input
                  className="lpe-input lpe-share-url-input"
                  readOnly
                  value={result.urls[key]}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="lpe-btn"
                  onClick={() => copy(result.urls[key], key)}
                  disabled={revoked || expired}
                >
                  {copiedKey === key ? COPY.shareCopyOneDone : COPY.shareCopyOne}
                </button>
              </li>
            ))}
          </ul>
          <div className="lpe-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="lpe-btn lpe-btn-primary"
              onClick={() => copy(block, "all")}
              disabled={revoked || expired}
            >
              {copiedKey === "all" ? COPY.shareCopyAllDone : COPY.shareCopyAll}
            </button>
            <button
              type="button"
              className="lpe-btn"
              onClick={onRevoke}
              disabled={revoking || revoked || expired}
            >
              {revoking ? COPY.shareRevokingMsg : COPY.shareRevokeBtn}
            </button>
            <button type="button" className="lpe-btn" onClick={onClose}>
              {COPY.shareCloseBtn}
            </button>
          </div>
          {revokeErr && <div className="lpe-debug-note" role="alert">{revokeErr}</div>}
        </div>
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`;
}
