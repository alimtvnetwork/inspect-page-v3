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
import type { ElementSnapshot } from "@element/collectElementSnapshot";
import { asElementSnapshot } from "@shared/narrow";
import { ShareSettingsSection, ShareDialog } from "./ShareSettingsSection";
import { SettingsSection } from "./SettingsSection";
import { MultiPickChips } from "./MultiPickChips";
import { ElementInspectorWithCode } from "./ElementInspectorWithCode";
import { ShareLinksButton } from "./ShareLinksButton";
import { ExportDiagnostics } from "./ExportDiagnostics";
import { DebugPreview } from "./DebugPreview";
import { FullPageActions } from "./FullPageActions";
import {
  requestFullPageExport,
  requestEnterPicker,
  requestExitPicker,
  requestCancelFullPage,
  requestSettingsPatch,
  requestShareSettingsPatch,
  requestCreateShareSession,
} from "./panelActions";
import {
  buildElementArtifacts,
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
          ...(asElementSnapshot(p.elementSnapshot)
            ? { elementSnapshot: asElementSnapshot(p.elementSnapshot) }
            : {}),
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
        ...(asElementSnapshot(p.elementSnapshot)
          ? { elementSnapshot: asElementSnapshot(p.elementSnapshot) }
          : {}),
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
        const res = await requestFullPageExport(tid, settings!);
        setState({
          status: PanelStatus.Success,
          successFilename: res.bundleFilename,
          successTelemetry: res.telemetry,
          fullPageArtifacts: res.artifacts,
          lastAction: kind,
        });
      } else {
        await requestEnterPicker(tid);
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
      try { await requestExitPicker(activeTabId ?? -1); } catch { /* best effort */ }
    } else if (state.lastAction === "fullPage") {
      try { await requestCancelFullPage(activeTabId ?? -1); } catch { /* best effort */ }
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
      const next = await requestSettingsPatch(patch);
      setSettings(next);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onShareSettingsPatch = useCallback(async (patch: Partial<ShareSettings>) => {
    try {
      const next = await requestShareSettingsPatch(patch);
      setShareSettingsState(next);
    } catch { /* ignore */ }
  }, []);

  const onShare = useCallback(async (artifacts: ExportArtifacts): Promise<void> => {
    const res = await requestCreateShareSession(
      artifacts,
      activeUrl ?? artifacts.meta?.url ?? "",
    );
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
                  elementSnapshot: asElementSnapshot(pick.elementSnapshot),
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
                  elementSnapshot: asElementSnapshot(pick.elementSnapshot),
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

