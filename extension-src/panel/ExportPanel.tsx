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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { COPY } from "@shared/copy";
import {
  INSPECT_PAGE_WP_SITE_URL,
  INSPECT_PAGE_PRICING_URL,
} from "@shared/constants";
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
import { getOnboardingState, dismissOnboarding } from "@shared/onboarding";
import { shareConfigured } from "@shared/shareSettings";
import { getShareSettings } from "@shared/shareSettings";
import {
  applyExtensionTheme,
  applyExtensionThemeToElement,
  loadStoredExtTheme,
  saveStoredExtTheme,
  subscribeExtTheme,
  DEFAULT_EXT_PRESET_ID,
  type StoredExtTheme,
} from "./extensionThemes";
import { AppearanceSection } from "./AppearanceSection";
import { startBillingCheckout } from "../share/startBillingCheckout";
import { pollBillingUntilPro } from "../share/pollBillingUntilPro";
import { emitBilling } from "../share/billingTelemetry";
import { InspectShell } from "./inspect/InspectShell";
import { ElementInspector } from "./element/ElementInspector";
import { CodeDrawer } from "./element/CodeDrawer";
import type { ElementSnapshot } from "@element/collectElementSnapshot";
import { ShareSettingsSection, ShareDialog } from "./ShareSettingsSection";
import { DebugPreview } from "./DebugPreview";
import { FullPageActions } from "./FullPageActions";
import {
  buildElementArtifacts,
  buildCombinedElementArtifacts,
  buildFullPageArtifacts,
} from "./artifacts";

type PanelMode = "export" | "pick" | "inspect";
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
  /** C3 — rich element snapshot for the new Inspector view. */
  elementSnapshot?: ElementSnapshot;
  /**
   * v2.7.2 — multi-element picker results. When set (length > 0), the
   * inspector renders a horizontal chip strip; clicking a chip swaps the
   * inspector body to that element's snapshot. The active chip is tracked
   * by `activePickIndex`. The single `debugPreview` + `elementSnapshot`
   * fields above always mirror `multiPicks[activePickIndex]` so existing
   * render paths keep working unchanged.
   */
  multiPicks?: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>;
  activePickIndex?: number;
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
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(true);
  const [mode, setMode] = useState<PanelMode>("export");
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [settingsTab, setSettingsTab] = useState<"general" | "share" | "appearance">("general");
  const [extTheme, setExtTheme] = useState<StoredExtTheme>({ presetId: DEFAULT_EXT_PRESET_ID });

  const onToggleSettings = useCallback(() => {
    setSettingsOpen((v) => !v);
  }, []);
  const onCloseSettings = useCallback(() => {
    setSettingsOpen(false);
    settingsBtnRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCloseSettings(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, onCloseSettings]);

  const disabled = isDisabledUrl(activeUrl);

  // Stable ref to the active runAction so the "pending action" effect
  // below (which runs once after settings load) can call the latest
  // version without re-binding.
  const runActionRef = useRef<((k: "fullPage" | "pick") => void) | null>(null);

  // ---- Load onboarding state ----
  useEffect(() => {
    let isMounted = true;
    getOnboardingState()
      .then((s) => { if (isMounted) setOnboardingDismissed(s.dismissed); })
      .catch(() => { /* ignore */ });
    return () => { isMounted = false; };
  }, []);

  // onDismissOnboarding removed alongside Smart Share banner (UX request).

  // ---- Load settings on mount ----
  useEffect(() => {
    let isMounted = true;
    sendToBackground<Record<string, never>, GetSettingsResponse>(MessageKind.GetSettings, {})
      .then((s) => { if (isMounted) setSettings(s); })
      .catch((e: unknown) => {
        if (!isMounted) return;
        const msg = e instanceof Error ? e.message : String(e);
        setSettingsError(msg);
      });
    return () => { isMounted = false; };
  }, []);

  // ---- Load Share Links credentials ----
  useEffect(() => {
    let isMounted = true;
    sendToBackground<Record<string, never>, ShareSettings>(MessageKind.GetShareSettings, {})
      .then((s) => { if (isMounted) setShareSettingsState(s); })
      .catch(() => { /* non-fatal */ });
    return () => { isMounted = false; };
  }, []);

  // ---- Load extension theme preset + subscribe to changes ----
  useEffect(() => {
    let isMounted = true;
    void loadStoredExtTheme().then((v) => {
      if (!isMounted) return;
      setExtTheme(v);
      applyExtensionTheme(v);
    });
    const unsub = subscribeExtTheme((v) => {
      setExtTheme(v);
      applyExtensionTheme(v);
    });
    return () => { isMounted = false; unsub(); };
  }, []);

  // Re-apply before paint so clicking a preset visibly recolors the active
  // popup/floating panel immediately, including Shadow DOM mounts.
  useLayoutEffect(() => {
    if (rootRef.current) applyExtensionThemeToElement(rootRef.current, extTheme);
    applyExtensionTheme(extTheme);
  }, [extTheme, surface]);

  const onExtThemeChange = useCallback((next: StoredExtTheme) => {
    setExtTheme(next);
    applyExtensionTheme(next);
    void saveStoredExtTheme(next);
  }, []);

  // ---- Step 2 (Pick-into-popup, Option A) ----
  // On popup mount, hydrate the Pick tab from chrome.storage.session if the
  // user picked something since the last popup open. Picks live for ~10 min
  // and are cleared once consumed so they don't haunt unrelated tabs.
  useEffect(() => {
    if (surface !== "popup") return;
    let isMounted = true;
    (async () => {
      try {
        const r = await chrome.storage.session.get("inspect-page:last-pick");
        const entry = r["inspect-page:last-pick"] as
          | { ts: number; pageUrl: string; payload: StatusUpdatePayload }
          | undefined;
        if (!isMounted || !entry) return;
        const fresh = Date.now() - entry.ts < 10 * 60 * 1000;
        if (!fresh) {
          await chrome.storage.session.remove("inspect-page:last-pick");
          return;
        }
        const p = entry.payload;
        setState((prev) => ({
          ...prev,
          status: PanelStatus.Idle,
          message: p.message,
          ...(p.debugPreview ? { debugPreview: p.debugPreview } : {}),
          ...(p.elementSnapshot ? { elementSnapshot: p.elementSnapshot as ElementSnapshot } : {}),
          ...(p.multiElementSnapshot && p.multiElementSnapshot.length > 0
            ? {
                multiPicks: p.multiElementSnapshot,
                activePickIndex: p.multiElementSnapshot.length - 1,
              }
            : {}),
          lastAction: "pick",
        }));
        setMode("pick");
        await chrome.storage.session.remove("inspect-page:last-pick");
      } catch { /* session storage unavailable */ }
    })();
    return () => { isMounted = false; };
  }, [surface]);

  // ---- Listen for StatusUpdate broadcasts from SW (stages 5+) ----
  useEffect(() => {
    const handlePayload = (p: StatusUpdatePayload): void => {
      setState((prev) => ({
        ...prev,
        status: p.status,
          message: p.status === PanelStatus.Idle ? undefined : (p.message ?? prev.message),
        progress: p.progress,
        ...(p.status === PanelStatus.Error
          ? { errorCode: p.errorCode, errorDetail: p.errorDetail }
          : {}),
        ...(p.debugPreview ? { debugPreview: p.debugPreview } : {}),
        ...(p.elementSnapshot ? { elementSnapshot: p.elementSnapshot as ElementSnapshot } : {}),
        ...(p.multiElementSnapshot && p.multiElementSnapshot.length > 0
          ? {
              multiPicks: p.multiElementSnapshot,
              activePickIndex: p.multiElementSnapshot.length - 1,
            }
          : {}),
        ...(p.status === PanelStatus.Success && p.telemetry
          ? { successTelemetry: p.telemetry }
          : {}),
        ...(p.status === PanelStatus.Success && p.fullPageArtifacts
          ? { fullPageArtifacts: p.fullPageArtifacts }
          : {}),
        ...(p.status === PanelStatus.Idle
          ? { progress: undefined, errorCode: undefined, errorDetail: undefined }
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

  // ---- Action handlers ----
  const runAction = useCallback(async (kind: "fullPage" | "pick") => {
    if (disabled) return;
    // Popup auto-route: the element picker steals focus to the page and
    // closes the popup immediately, so we hand it off to the in-page
    // floating panel (which survives focus changes). Full-page export does
    // NOT need this — running it inline from the popup avoids a second
    // "disappear" (the floating panel has to hide itself during capture to
    // stay out of the screenshot). The popup closing is handled gracefully
    // by the toolbar badge + completion notification from the background.
    if (surface === "popup" && kind === "pick") {
      try {
        const tid = activeTabId ?? -1;
        await chrome.storage.session.set({
          "inspect-page:pending-action": { kind, ts: Date.now() },
        });
        await sendToBackground<{ tabId: number }, unknown>(
          MessageKind.MountFloatingPanel, { tabId: tid },
        );
        setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 80);
        return;
      } catch {
        // Fall through to in-popup behavior if the handoff failed (e.g.
        // chrome:// pages where content scripts can't be injected).
      }
    }
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
        // Option A — close the popup so the user can click an element on the
        // page. When they re-open the popup, the mount effect above hydrates
        // the picked element from chrome.storage.session.
        if (surface === "popup") {
          setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 150);
        }
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

  // Keep runActionRef pointed at the latest runAction so the floating-panel
  // pending-action consumer below can fire it once settings are loaded.
  useEffect(() => { runActionRef.current = (k) => void runAction(k); }, [runAction]);

  // Floating-panel side of the popup→panel handoff. When the popup writes
  // `inspect-page:pending-action`, the floating panel reads it on mount
  // (after settings are available) and runs the requested action.
  useEffect(() => {
    if (surface !== "floating") return;
    if (settings === null) return; // wait for settings before dispatching
    let isMounted = true;
    (async () => {
      try {
        const r = await chrome.storage.session.get("inspect-page:pending-action");
        const entry = r["inspect-page:pending-action"] as
          | { kind: "fullPage" | "pick"; ts: number }
          | undefined;
        if (!isMounted || !entry) return;
        // Only honor very recent handoffs (10 s) to avoid stale auto-runs.
        const fresh = Date.now() - entry.ts < 10_000;
        await chrome.storage.session.remove("inspect-page:pending-action");
        if (!fresh) return;
        if (entry.kind === "pick") setMode("pick");
        else setMode("export");
        runActionRef.current?.(entry.kind);
      } catch { /* session storage unavailable */ }
    })();
    return () => { isMounted = false; };
  }, [surface, settings]);

  const onCancel = useCallback(async () => {
    if (state.lastAction === "pick") {
      try {
        await sendToBackground<{ tabId: number }, void>(
          MessageKind.ExitPickerMode, { tabId: activeTabId ?? -1 },
        );
      } catch {
        // best effort
      }
    } else if (state.lastAction === "fullPage") {
      try {
        await sendToBackground<{ tabId: number }, void>(
          MessageKind.CancelFullPageExport, { tabId: activeTabId ?? -1 },
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

  /**
   * B3 — Direct sign-in trigger. Both the onboarding "Sign in" button and
   * the signed-out Share Links button call this so the user is taken
   * straight to the WP login tab instead of being dumped into Settings.
   * On success we surface a short hint in the status region.
   */
  const onSignIn = useCallback(async () => {
    const siteUrl = INSPECT_PAGE_WP_SITE_URL;
    if (!siteUrl) {
      setState({
        status: PanelStatus.Error,
        message: COPY.shareNotConfiguredMsg,
        errorCode: ErrorCode.E_SHARE_AUTH,
      });
      return;
    }
    try {
      await sendToBackground<{ siteUrl: string }, void>(MK.OpenLoginPopup, { siteUrl });
      setState((s) => ({
        ...s,
        status: PanelStatus.Success,
        successFilename: COPY.shareLoginOpenedMsg,
      }));
      // Mark onboarding as dismissed so the banner doesn't keep nagging.
      if (!onboardingDismissed) {
        setOnboardingDismissed(true);
        try { await dismissOnboarding(); } catch { /* ignore */ }
      }
    } catch (err) {
      const me = err instanceof MessageError ? err : null;
      setState({
        status: PanelStatus.Error,
        message: me?.message ?? (err instanceof Error ? err.message : String(err)),
        errorCode: me?.code ?? ErrorCode.E_SHARE_AUTH,
      });
    }
  }, [onboardingDismissed]);

  const busy = useMemo(
    () => BUSY_STATUSES.has(state.status) && !(state.status === PanelStatus.Selecting && !!state.elementSnapshot),
    [state.status, state.elementSnapshot],
  );

  return (
    <div ref={rootRef} className="lpe-root" data-lpe-theme="dark" data-lpe-surface={surface} role="region" aria-label={COPY.appName}>
      <header
        className="lpe-header"
        data-draggable={surface === "floating" ? "true" : "false"}
        data-drag-handle={surface === "floating" ? "true" : undefined}
      >
        <button
          ref={settingsBtnRef}
          type="button"
          className="lpe-header-btn"
          onClick={onToggleSettings}
          aria-label={COPY.settingsHeader}
          aria-expanded={settingsOpen}
          aria-haspopup="dialog"
          title={COPY.settingsHeader}
        >≡</button>
        <span className="lpe-header-title">{COPY.appName}</span>
        {surface === "floating" && (
          <>
            <button type="button" className="lpe-header-btn" onClick={onMinimize} aria-label={COPY.btnMinimize}>─</button>
            <button type="button" className="lpe-header-btn" onClick={onClose} aria-label={COPY.btnClose}>✕</button>
          </>
        )}
      </header>

      {settingsOpen && (
        <div className="lpe-settings-popover" role="dialog" aria-label={COPY.settingsHeader}>
          <div className="lpe-settings-popover-head">
            <strong>{COPY.settingsHeader}</strong>
            <button
              type="button"
              className="lpe-header-btn"
              onClick={onCloseSettings}
              aria-label={COPY.btnClose}
            >✕</button>
          </div>
          <div className="lpe-settings-tabs" role="tablist" aria-label="Settings sections">
            {([
              ["general", "General"],
              ["share", "Smart Share"],
              ["appearance", "Appearance"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={settingsTab === id}
                className="lpe-settings-tab"
                data-active={settingsTab === id ? "true" : "false"}
                onClick={() => setSettingsTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="lpe-settings-popover-body">
            {settingsTab === "general" && settings && (
              <SettingsSection
                settings={settings}
                error={settingsError}
                onPatch={onSettingsPatch}
              />
            )}
            {settingsTab === "share" && shareSettings && (
              <ShareSettingsSection
                settings={shareSettings}
                onPatch={onShareSettingsPatch}
              />
            )}
            {settingsTab === "appearance" && (
              <AppearanceSection
                value={extTheme}
                onChange={onExtThemeChange}
              />
            )}
          </div>
        </div>
      )}

      <div className="lpe-tabs" role="tablist" aria-label={COPY.appName}>
        {(["export", "pick", "inspect"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className="lpe-tab"
            data-active={mode === m ? "true" : "false"}
            onClick={() => setMode(m)}
          >
            {m === "export" ? COPY.tabExport : m === "pick" ? COPY.tabPick : COPY.tabInspect}
          </button>
        ))}
      </div>

      {/* Smart Share onboarding banner removed per UX request (v2.7.0+) */}

      <div className="lpe-body" data-mode={mode}>
        {mode === "inspect" ? (
          <InspectShell />
        ) : disabled ? (
          <div className="lpe-not-available" role="alert">{COPY.notAvailable}</div>
        ) : (
          <>
            {mode === "export" && (
              <>
                <button
                  type="button"
                  className="lpe-btn lpe-btn-primary"
                  onClick={onFullPage}
                  disabled={busy || settings === null}
                >
                  {COPY.btnFullPage}
                </button>
                {!busy && state.status !== PanelStatus.Success && (
                  <div className="lpe-status-hint lpe-status-hint--inline" aria-live="polite">
                    <span className="lpe-status-hint-dot" aria-hidden="true" />
                    <span className="lpe-status-hint-text">{COPY.statusLongHint}</span>
                  </div>
                )}
                <ShareLinksButton
                  shareSettings={shareSettings}
                  hasArtifacts={!!state.fullPageArtifacts}
                  busy={busy}
                  artifacts={state.fullPageArtifacts
                    ? buildFullPageArtifacts(state.fullPageArtifacts, activeUrl)
                    : null}
                  onShare={onShare}
                  onSignIn={() => void onSignIn()}
                />
              </>
            )}
            {mode === "pick" && (
              <>
                {surface !== "inspect-popout" && !state.elementSnapshot && state.status !== PanelStatus.PickerActive && (
                  <div className="lpe-pick-hint" role="note">{COPY.pickHint}</div>
                )}
                <button
                  type="button"
                  className="lpe-btn lpe-btn-primary"
                  onClick={onPick}
                  disabled={(busy && state.status !== PanelStatus.Selecting) || settings === null}
                >
                  {state.elementSnapshot ? COPY.pickAnother : COPY.btnPick}
                </button>
                <ShareLinksButton
                  shareSettings={shareSettings}
                  hasArtifacts={!!state.debugPreview}
                  busy={busy}
                  artifacts={state.debugPreview
                    ? buildElementArtifacts(state.debugPreview, activeUrl)
                    : null}
                  onShare={onShare}
                  onSignIn={() => void onSignIn()}
                />
              </>
            )}
          </>
        )}

        {(() => {
          const pickerStatus =
            state.status === PanelStatus.PickerActive ||
            state.status === PanelStatus.Selecting;
          const exportBusy = busy && mode === "export" && !pickerStatus;
          const showStatusHere =
            (state.status !== PanelStatus.Idle || exportBusy) && (
              mode === "export" ? !pickerStatus :
              mode === "pick"   ? pickerStatus || (state.status === PanelStatus.Error && !!state.elementSnapshot) :
              false
            );
          if (!showStatusHere) return null;
          return (
        <div
          className="lpe-status"
          data-status={state.status}
          role="status"
          aria-live="polite"
        >
          {state.status !== PanelStatus.Idle && (
            <div className="lpe-status-message">{statusLabel(state)}</div>
          )}
          {state.status === PanelStatus.Capturing && state.progress && (
            <div className="lpe-progress" aria-hidden="true">
              <div
                className="lpe-progress-bar"
                style={{ width: `${(state.progress.done / Math.max(1, state.progress.total)) * 100}%` }}
              />
            </div>
          )}
          {exportBusy && (
            <div className="lpe-status-hint" aria-live="polite">
              <span className="lpe-status-hint-dot" aria-hidden="true" />
              <span className="lpe-status-hint-text">{COPY.statusLongHint}</span>
            </div>
          )}
          {exportBusy && (
            <div className="lpe-status-actions">
              <button type="button" className="lpe-btn" onClick={onCancel}>{COPY.btnCancel}</button>
            </div>
          )}
          {state.status === PanelStatus.PickerActive && (
            <div className="lpe-status-actions">
              <button type="button" className="lpe-btn" onClick={onCancel}>{COPY.btnCancelPicker}</button>
            </div>
          )}
          {state.status === PanelStatus.Error && (
            <div style={{ marginTop: 8 }}>
              <ExportDiagnostics
                code={state.errorCode}
                message={state.message}
                detail={state.errorDetail}
              />
              <div className="lpe-row" style={{ marginTop: 8 }}>
              <button type="button" className="lpe-btn" onClick={onCopyDetails}>{COPY.btnCopyDetails}</button>
              <button type="button" className="lpe-btn lpe-btn-primary" onClick={onRetry}>{COPY.btnRetry}</button>
              {state.errorCode === ErrorCode.E_SHARE_QUOTA_FREE && (
                <button
                  type="button"
                  className="lpe-btn lpe-btn-primary"
                  onClick={async () => {
                    emitBilling("upgrade_clicked", "inline_quota_error");
                    try {
                      const { url } = await startBillingCheckout({ getShareSettings });
                      if (typeof window !== "undefined" && url) {
                        emitBilling("checkout_opened", "inline_quota_error");
                        window.open(url, "_blank", "noopener,noreferrer");
                        pollBillingUntilPro({ getShareSettings });
                      }
                    } catch (err) {
                      emitBilling("checkout_failed", "inline_quota_error", {
                        reason: err instanceof Error ? err.message : String(err),
                      });
                      if (typeof window !== "undefined") {
                        window.open(INSPECT_PAGE_PRICING_URL, "_blank", "noopener,noreferrer");
                      }
                    }
                  }}
                >
                  {COPY.shareUpgradeBtn}
                </button>
              )}
              </div>
            </div>
          )}
          {state.status === PanelStatus.Success && state.successTelemetry && (
            <TelemetrySummary counts={state.successTelemetry} />
          )}
        </div>
          );
        })()}

        {mode === "export" && state.status === PanelStatus.Success && state.fullPageArtifacts && (
          <FullPageActions
            artifacts={state.fullPageArtifacts}
            activeUrl={activeUrl}
            shareEnabled={!!shareSettings && !!shareSettings.nonce && !!shareSettings.siteUrl}
            onShare={onShare}
          />
        )}

        {/*
         * Show the rich Inspector view (identity + box-model + text props +
         * selection colors/contrast) as soon as a snapshot is available.
         * Previous guard `!busy` hid it during PanelStatus.Selecting, so users
         * saw "nothing" after picking until/unless the export download
         * completed. Only hide while the picker is still active.
         */}
        {mode === "pick" && state.elementSnapshot && state.status !== PanelStatus.PickerActive && (
          <>
          {state.multiPicks && state.multiPicks.length > 1 && (
            <MultiPickChips
              picks={state.multiPicks}
              activeIndex={state.activePickIndex ?? state.multiPicks.length - 1}
              onSelect={(idx) => setState((s) => {
                const pick = s.multiPicks?.[idx];
                if (!pick) return s;
                return {
                  ...s,
                  activePickIndex: idx,
                  debugPreview: pick.debugPreview,
                  elementSnapshot: pick.elementSnapshot as ElementSnapshot | undefined,
                };
              })}
              onRemove={(idx) => setState((s) => {
                if (!s.multiPicks) return s;
                const next = s.multiPicks.filter((_, i) => i !== idx);
                if (next.length === 0) {
                  return {
                    ...s,
                    multiPicks: undefined,
                    activePickIndex: undefined,
                    debugPreview: undefined,
                    elementSnapshot: undefined,
                    status: PanelStatus.Idle,
                  };
                }
                const prevActive = s.activePickIndex ?? next.length;
                let nextActive = prevActive;
                if (idx === prevActive) nextActive = Math.min(idx, next.length - 1);
                else if (idx < prevActive) nextActive = prevActive - 1;
                const pick = next[nextActive];
                return {
                  ...s,
                  multiPicks: next,
                  activePickIndex: nextActive,
                  debugPreview: pick.debugPreview,
                  elementSnapshot: pick.elementSnapshot as ElementSnapshot | undefined,
                };
              })}
            />
          )}
          <ElementInspectorWithCode
            snapshot={state.elementSnapshot}
            preview={state.debugPreview}
            activeUrl={activeUrl}
            shareEnabled={!!shareSettings && !!shareSettings.nonce && !!shareSettings.siteUrl}
            onShare={onShare}
            pickerLocked={state.status === PanelStatus.PickerActive}
            multiPicks={state.multiPicks}
            onTogglePickerLock={(next) => {
              // ON  → re-arm the picker so user can hover/pick another element.
              // OFF → exit picker mode but keep the current Inspector view.
              if (next) void runAction("pick");
              else void sendToBackground<{ tabId: number }, void>(
                MessageKind.ExitPickerMode, { tabId: activeTabId ?? -1 },
              ).catch(() => undefined);
            }}
            onBack={() => setState((s) => ({ ...s, elementSnapshot: undefined, debugPreview: undefined, multiPicks: undefined, activePickIndex: undefined, status: PanelStatus.Idle }))}
          />
          </>
        )}

        {mode === "pick" && state.debugPreview && !busy && (
          <DebugPreview
            preview={state.debugPreview}
            activeUrl={activeUrl}
            shareEnabled={!!shareSettings && !!shareSettings.nonce && !!shareSettings.siteUrl}
            onShare={onShare}
            onClear={() => setState((s) => ({ ...s, debugPreview: undefined }))}
          />
        )}

        {/* Settings + Share Settings moved to header ≡ menu in Phase 2.
            Intentionally hidden from the default first view. */}
      </div>
      {shareResult && (
        <ShareDialog
          result={shareResult}
          onClose={() => setShareResult(null)}
        />
      )}
      {surface === "floating" && (
        <div
          className="lpe-resize-handle"
          data-resize-handle="true"
          aria-label={COPY.lblResizePanel}
          title={COPY.lblResizePanel}
          role="separator"
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
    <details className="lpe-settings" open>
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
  // (helper stays below)
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

/**
 * v2.7.2 — combine N picked elements into a single ExportArtifacts so the
 * existing four-mode toolbar (MD / MD+files / ZIP / Smart Share) produces
 * one merged file with per-element sections in click order.
 */
function buildCombinedElementArtifacts(
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
    const snap = p.elementSnapshot as ElementSnapshot | undefined;
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
  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> =>
    (await fetch(dataUrl)).blob();
  const fenceFor = (k: "html" | "css" | "js"): string =>
    k === "js" ? "javascript" : k;
  const buildSingleMd = (k: "html" | "css" | "js"): string =>
    `# Page — ${artifacts.meta.url}\n\n## ${k.toUpperCase()}\n\n\`\`\`${fenceFor(k)}\n${artifacts[k] || ""}\n\`\`\`\n`;
  const buildCombinedMd = (): string =>
    `# Page — ${artifacts.meta.url}\n\n_Captured ${artifacts.meta.capturedAtIso}_\n\n## HTML\n\n\`\`\`html\n${artifacts.html}\n\`\`\`\n\n## CSS\n\n\`\`\`css\n${artifacts.css}\n\`\`\`\n\n## JS\n\n\`\`\`javascript\n${artifacts.js}\n\`\`\`\n`;

  const onDownloadOne = useCallback(async (k: "html" | "css" | "js") => {
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
    try {
      const blob = await dataUrlToBlob(artifacts.screenshotDataUrl);
      const ext = blob.type.includes("jpeg") ? "jpg" : "png";
      await saveBlobWithPrompt(blob, `inspect-page-fullpage-${domainSafe()}-${tsNow()}.${ext}`);
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
      await saveBlobWithPrompt(blob, `inspect-page-fullpage-${safe}-${ts}.zip`);
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


function compactSelectorLabel(selectorPath: string): string {
  const parts = selectorPath.split(" > ").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || selectorPath;
}

function pickDisplayLabel(pick: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>[number]): {
  title: string;
  selector: string;
} {
  const snapshot = pick.elementSnapshot as ElementSnapshot | undefined;
  const friendly = snapshot?.identity?.label?.trim();
  const chip = snapshot?.identity?.selectorChip?.trim();
  const compact = compactSelectorLabel(pick.selectorPath).trim();
  return {
    title: friendly || chip || compact || `Element`,
    selector: chip && chip !== friendly ? chip : compact || pick.selectorPath,
  };
}

function MultiPickChips(
  {
    picks, activeIndex, onSelect, onRemove,
  }: {
    picks: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>;
    activeIndex: number;
    onSelect: (idx: number) => void;
    onRemove: (idx: number) => void;
  },
): JSX.Element {
  return (
    <section aria-label="Selected elements" className="lpe-multi-picks">
      <div className="lpe-multi-picks-head">
        <span>Selected elements</span>
        <span className="lpe-multi-picks-count">{picks.length}</span>
      </div>
      <div className="lpe-multi-picks-list">
        {picks.map((p, idx) => {
          const active = idx === activeIndex;
          const label = pickDisplayLabel(p);
          return (
            <div
              key={`${idx}-${p.selectorPath}`}
              className="lpe-multi-pick"
              data-active={active ? "true" : "false"}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(idx)}
                title={p.selectorPath}
                className="lpe-multi-pick-main"
              >
                <span aria-hidden="true" className="lpe-multi-pick-index">{idx + 1}</span>
                <span className="lpe-multi-pick-copy">
                  <span className="lpe-multi-pick-label">{label.title}</span>
                  <span className="lpe-multi-pick-selector">{label.selector}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Remove pick ${idx + 1}`}
                onClick={() => onRemove(idx)}
                className="lpe-multi-pick-remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ElementInspectorWithCode(
  {
    snapshot, onBack, preview, activeUrl, shareEnabled, onShare, onTogglePickerLock, pickerLocked, multiPicks,
  }: {
    snapshot: ElementSnapshot;
    onBack: () => void;
    preview?: StatusUpdatePayload["debugPreview"];
    activeUrl?: string;
    shareEnabled?: boolean;
    onShare?: (artifacts: ExportArtifacts) => Promise<void>;
    onTogglePickerLock?: (next: boolean) => void;
    pickerLocked?: boolean;
    multiPicks?: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>;
  },
): JSX.Element {
  const [showCode, setShowCode] = useState(false);
  const artifacts = multiPicks && multiPicks.length > 1
    ? buildCombinedElementArtifacts(multiPicks, activeUrl)
    : preview ? buildElementArtifacts(preview, activeUrl) : null;
  return (
    <>
      <ElementInspector
        snapshot={snapshot}
        onBack={onBack}
        onShowCode={() => setShowCode(true)}
        onTogglePickerLock={onTogglePickerLock}
        pickerLocked={pickerLocked}
      />
      {showCode && <CodeDrawer snapshot={snapshot} onClose={() => setShowCode(false)} />}
      {artifacts && (
        <div className="lpe-eli-export">
          <ExportModes
            artifacts={artifacts}
            shareEnabled={shareEnabled}
            onShare={onShare}
          />
        </div>
      )}
    </>
  );
}

interface ShareLinksButtonProps {
  shareSettings: ShareSettings | null;
  hasArtifacts: boolean;
  busy: boolean;
  artifacts: ExportArtifacts | null;
  onShare: (artifacts: ExportArtifacts) => Promise<void>;
  onSignIn: () => void;
}

function ShareLinksButton(props: ShareLinksButtonProps): JSX.Element {
  const { shareSettings, hasArtifacts, busy, artifacts, onShare, onSignIn } = props;
  const signedIn = !!shareSettings && !!shareSettings.nonce && !!shareSettings.siteUrl;
  if (!signedIn) {
    return (
      <button
        type="button"
        className="lpe-btn"
        onClick={onSignIn}
        disabled={busy}
        title={COPY.shareSignInBtn}
      >
        {COPY.shareSignInBtn} — {COPY.exportModeShare}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="lpe-btn"
      onClick={() => { if (artifacts) void onShare(artifacts); }}
      disabled={busy || !hasArtifacts || !artifacts}
      title={hasArtifacts ? COPY.exportModeShare : "Run export first"}
    >
      {COPY.exportModeShare}
    </button>
  );
}

/**
 * ExportDiagnostics — surfaces structured cause for export failures.
 *
 * Background enriches `detail` as: `<rawCause> || phase=<name>#<n> | tabStatus=<s> | startUrl=<u> | nowUrl=<u>`.
 * We split that envelope back out so users see exactly which phase/attempt
 * failed and the real underlying error, instead of only the surface code.
 */
interface ExportDiagnosticsProps {
  code?: ErrorCode;
  message?: string;
  detail?: string;
}

function ExportDiagnostics({ code, message, detail }: ExportDiagnosticsProps): JSX.Element | null {
  if (!code && !message && !detail) return null;
  const detailText = detail ?? "";
  const looksStructured = /(^| \| )\w+=/.test(detailText);
  const [rawCausePart, diagPart] = detailText.includes(" || ")
    ? detailText.split(" || ", 2) as [string, string]
    : looksStructured
      ? ["", detailText]
      : [detailText, ""];
  const fields: Record<string, string> = {};
  for (const tok of diagPart.split(" | ").map((s) => s.trim()).filter(Boolean)) {
    const eq = tok.indexOf("=");
    if (eq > 0) fields[tok.slice(0, eq)] = tok.slice(eq + 1);
  }
  const phase = fields.phase ?? "";
  const phaseName = phase.includes("#") ? phase.split("#")[0] : phase;
  const phaseAttempt = phase.includes("#") ? phase.split("#")[1] : "";
  const rows: Array<[string, string]> = [];
  if (code) rows.push(["Code", code]);
  if (phaseName) rows.push(["Phase", phaseName]);
  if (phaseAttempt) rows.push(["Attempt", `#${phaseAttempt}`]);
  if (fields.tabStatus) rows.push(["Tab status", fields.tabStatus]);
  if (fields.startUrl) rows.push(["Start URL", fields.startUrl]);
  if (fields.nowUrl) rows.push(["Now URL", fields.nowUrl]);
  if (rawCausePart && rawCausePart !== message) rows.push(["Cause", rawCausePart]);
  return (
    <details className="lpe-export-diagnostics" open>
      <summary>Export diagnostics</summary>
      <div className="lpe-export-diagnostics-body">
        {message && (
          <div className="lpe-export-diagnostics-message">
            <strong>Message: </strong>{message}
          </div>
        )}
        {rows.length > 0 && (
          <table>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
