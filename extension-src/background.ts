/**
 * Service worker entry. Stage 2 — message router with Ping/GetSettings/SetSettings.
 */
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, MessageRouter, makeRequestId, sendToTab } from "@shared/messaging";
import { getPanelPosition, getSettings, setPanelPosition, setSettings } from "@shared/settings";
import { getShareSettings, normalizeBaseUrl, setShareSettings } from "@shared/shareSettings";
import { createShareSession as createShareSessionImpl } from "@share/createShareSession";
import { revokeShareSession as revokeShareSessionImpl } from "@share/revokeShareSession";
import { waitForDownloadPath } from "./background/downloads";
import { captureInspectThumbnail } from "./background/thumbnail";
import { sendOffscreen, blobToDataUrl } from "./background/sendOffscreen";
import { ensureContentScript } from "./background/tabReady";
import {
  runFullPageExport,
  canceledFullPageTabs,
} from "./background/runFullPageExport";
// keepAlive module imported transitively via runFullPageExport for its
// side-effect listeners (chrome.alarms.onAlarm + chrome.runtime.onConnect).
import "./background/keepAlive";
import type {
  CollectPageArtifactsResponse,
  EnterPickerModePayload,
  EnterPickerModeResponse,
  ExitPickerModePayload,
  ExitPickerModeResponse,
  CreateShareSessionPayload,
  CreateShareSessionResponse,
  CheckShareAuthPayload,
  CheckShareAuthResponse,
  RevokeShareSessionPayload,
  RevokeShareSessionResponse,
  CancelFullPageExportPayload,
  CancelFullPageExportResponse,
  OpenLoginPopupPayload,
  OpenLoginPopupResponse,
  GetShareSettingsPayload,
  GetShareSettingsResponse,
  SetShareSettingsPayload,
  SetShareSettingsResponse,
  GetSettingsPayload,
  GetSettingsResponse,
  GetTabZoomPayload,
  GetTabZoomResponse,
  GetPanelPositionPayload,
  GetPanelPositionResponse,
  SetPanelPositionPayload,
  SetPanelPositionResponse,
  PingPayload,
  PingResponse,
  MountFloatingPanelPayload,
  MountFloatingPanelResponse,
  RunElementExportPayload,
  RunElementExportResponse,
  RunFullPageExportPayload,
  RunFullPageExportResponse,
  SetSettingsPayload,
  SetSettingsResponse,
  StatusUpdatePayload,
  CollectInspectSnapshotPayload,
  CollectInspectSnapshotResponse,
} from "@shared/types";
import { PanelStatus } from "@shared/enums";
import { ensureOffscreen } from "@capture/screenshotOrchestrator";
import { runElementExport } from "@element/runElementExport";

logger.info(LogCategory.Lifecycle, `Service worker booted v${__EXT_VERSION__}`);

const router = new MessageRouter();

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return;
    await ensureContentScript(tab.id);
    await sendToTab<MountFloatingPanelPayload, MountFloatingPanelResponse>(
      tab.id,
      MessageKind.MountFloatingPanel,
      { tabId: tab.id },
    );
  } catch (e) {
    logger.error(LogCategory.Lifecycle, "PANEL_MOUNT_FAILED", "Could not open in-page panel", e);
  }
});

router.on<MountFloatingPanelPayload, MountFloatingPanelResponse>(
  MessageKind.MountFloatingPanel,
  async ({ tabId }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for panel");
    }
    await ensureContentScript(tid);
    await sendToTab<MountFloatingPanelPayload, MountFloatingPanelResponse>(
      tid,
      MessageKind.MountFloatingPanel,
      { tabId: tid },
    );
  },
);

router.on<PingPayload, PingResponse>(MessageKind.Ping, (payload) => {
  logger.debug(LogCategory.Messaging, `Ping rtt=${Date.now() - payload.sentAtMs}ms`);
  return {
    extensionVersion: __EXT_VERSION__,
    receivedAtMs: Date.now(),
  };
});

router.on<GetSettingsPayload, GetSettingsResponse>(MessageKind.GetSettings, async () => {
  return getSettings();
});

router.on<SetSettingsPayload, SetSettingsResponse>(MessageKind.SetSettings, async (patch) => {
  return setSettings(patch);
});

router.on<GetTabZoomPayload, GetTabZoomResponse>(
  MessageKind.GetTabZoom,
  async ({ tabId }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) return { zoomFactor: 1 };
    try {
      return { zoomFactor: await chrome.tabs.getZoom(tid) };
    } catch {
      return { zoomFactor: 1 };
    }
  },
);

router.on<GetPanelPositionPayload, GetPanelPositionResponse>(
  MessageKind.GetPanelPosition, async () => getPanelPosition(),
);

router.on<SetPanelPositionPayload, SetPanelPositionResponse>(
  MessageKind.SetPanelPosition, async (patch) => setPanelPosition(patch),
);

router.on<GetShareSettingsPayload, GetShareSettingsResponse>(
  MessageKind.GetShareSettings, async () => getShareSettings(),
);

router.on<SetShareSettingsPayload, SetShareSettingsResponse>(
  MessageKind.SetShareSettings, async (patch) => setShareSettings(patch),
);

router.on<CreateShareSessionPayload, CreateShareSessionResponse>(
  MessageKind.CreateShareSession,
  async (payload) => createShareSessionImpl(payload, { getShareSettings, setShareSettings }),
);

router.on<CheckShareAuthPayload, CheckShareAuthResponse>(
  MessageKind.CheckShareAuth,
  async () => checkShareAuth(),
);

router.on<RevokeShareSessionPayload, RevokeShareSessionResponse>(
  MessageKind.RevokeShareSession,
  async ({ sessionId }) =>
    revokeShareSessionImpl(sessionId, { getShareSettings, setShareSettings }),
);

router.on<OpenLoginPopupPayload, OpenLoginPopupResponse>(
  MessageKind.OpenLoginPopup,
  async ({ siteUrl }) => {
    const base = normalizeBaseUrl(siteUrl);
    const url = `${base}/wp-admin/admin.php?page=inspect-page-bridge`;
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (e) {
      throw new MessageError(
        ErrorCode.E_SHARE_NETWORK,
        "Could not open WordPress login tab",
        e instanceof Error ? e.message : String(e),
      );
    }
  },
);

router.on<RunFullPageExportPayload, RunFullPageExportResponse>(
  MessageKind.RunFullPageExport,
  async ({ tabId, settings }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for export");
    }
    // Do not pre-flight `ensureContentScript` here. If Chrome rejects during a
    // reload/navigation (`The page failed to load.`), this router-level call
    // bypasses runFullPageExport's retry/diagnostic path and surfaces the old
    // generic E_NOT_AVAILABLE_HERE. The orchestrator owns readiness, retries,
    // reinjection, and phase-tagged errors.
    return runFullPageExport(tid, settings);
  },
);

router.on<CancelFullPageExportPayload, CancelFullPageExportResponse>(
  MessageKind.CancelFullPageExport,
  async ({ tabId }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid !== undefined) canceledFullPageTabs.add(tid);
  },
);

router.on<EnterPickerModePayload, EnterPickerModeResponse>(
  MessageKind.EnterPickerMode,
  async ({ tabId }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for picker");
    }
    try {
      await ensureContentScript(tid);
      await sendToTab<{ tabId: number }, void>(tid, MessageKind.EnterPickerMode, { tabId: tid });
    } catch (e) {
      throw new MessageError(
        ErrorCode.E_NOT_AVAILABLE_HERE,
        "Cannot start picker on this page",
        e instanceof Error ? e.message : String(e),
      );
    }
  },
);

router.on<ExitPickerModePayload, ExitPickerModeResponse>(
  MessageKind.ExitPickerMode,
  async ({ tabId }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) return;
    try {
      await sendToTab<{ tabId: number }, void>(tid, MessageKind.ExitPickerMode, { tabId: tid });
    } catch {
      // Tab may be closed; ignore.
    }
  },
);

// Phase A3 — Inspect Mode snapshot. Asks the CS to collect, then captures the
// visible viewport for the Overview hero thumbnail.
router.on<CollectInspectSnapshotPayload, CollectInspectSnapshotResponse>(
  MessageKind.CollectInspectSnapshot,
  async ({ tabId }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for inspect");
    }
    await ensureContentScript(tid);
    const csRes = await sendToTab<{ tabId: number }, { snapshot: unknown }>(
      tid, MessageKind.CollectInspectSnapshot, { tabId: tid },
    );
    const thumbnailDataUrl = await captureInspectThumbnail(tid);
    return { snapshot: csRes.snapshot, thumbnailDataUrl };
  },
);

// Phase A8b: Locate — forward the color target to the active tab's content
// script. The CS scans the live DOM and flashes matches in place.
router.on<{ tabId: number; target: string }, { count: number }>(
  MessageKind.LocateColor,
  async ({ tabId, target }, sender) => {
    let tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tid = tab?.id;
    }
    if (tid === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for locate");
    }
    await ensureContentScript(tid);
    return sendToTab<{ target: string }, { count: number }>(
      tid, MessageKind.LocateColor, { target },
    );
  },
);

// Forward Inspector "Locate" clicks to the active tab's content script.
router.on<{ tabId: number; selector: string }, { count: number }>(
  MessageKind.LocateElement,
  async ({ tabId, selector }, sender) => {
    let tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tid = tab?.id;
    }
    if (tid === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for locate element");
    }
    await ensureContentScript(tid);
    return sendToTab<{ selector: string }, { count: number }>(
      tid, MessageKind.LocateElement, { selector },
    );
  },
);

router.on<RunElementExportPayload, RunElementExportResponse>(
  MessageKind.RunElementExport,
  async (payload, sender) => {
    const tabId = payload.tabId > 0 ? payload.tabId : sender.tab?.id;
    if (tabId === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for element export");
    }
    const tab = await chrome.tabs.get(tabId);
    const settings = await getSettings();
    return runElementExport({ ...payload, tabId }, {
      tab,
      settings,
      url: payload.pageInfo.url,
      title: payload.pageInfo.title,
      viewportCssPx: payload.pageInfo.viewportCssPx,
      dpr: payload.pageInfo.dpr,
      extensionVersion: __EXT_VERSION__,
      broadcast,
    });
  },
);

// DownloadBlob — used by the panel/inspector "Export for AI" buttons so the
// user always gets a Save As… dialog instead of an auto-download to the
// default Downloads folder.
router.on<{ dataUrl: string; filename: string }, { downloadId: number; savedPath?: string }>(
  MessageKind.DownloadBlob,
  async ({ dataUrl, filename }) => {
    try {
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename,
        saveAs: true,
      });
      const savedPath = await waitForDownloadPath(downloadId).catch(() => undefined);
      return savedPath ? { downloadId, savedPath } : { downloadId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // User cancel in the Save As dialog is not a hard error.
      if (/user|cancel/i.test(msg)) return { downloadId: -1 };
      throw new MessageError(ErrorCode.E_DOWNLOAD_FAILED, "chrome.downloads failed", msg);
    }
  },
);

router.attach();

// (waitForDownloadPath, captureInspectThumbnail and helpers moved to ./background/* per R7 split)


// ensureContentScript / waitForTabReady / pingUntilReachable moved to
// ./background/tabReady.ts (R7 split).

// ---- Stage 9: keyboard shortcuts (E20: chrome.commands → CS) ----
chrome.commands?.onCommand?.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    if (command === "trigger-full-page") {
      const settings = await getSettings();
      await runFullPageExport(tab.id, settings);
    } else if (command === "trigger-pick-element") {
      await sendToTab<{ tabId: number }, void>(tab.id, MessageKind.EnterPickerMode, { tabId: tab.id });
    }
  } catch (e) {
    logger.error(LogCategory.Lifecycle, "CMD_FAIL", `command ${command} failed`, e);
  }
});

// Toolbar icon now uses manifest `default_popup`, which anchors the popup to
// the current tab (toolbar dropdown) instead of a detached window.

// SW keep-alive moved to ./background/keepAlive.ts (R7 split). The module
// import above also registers chrome.alarms.onAlarm + chrome.runtime.onConnect
// listeners as a side-effect.

/**
 * Stage 5 orchestrator — collect artifacts via CS, build ZIP with placeholder
 * PNG, download. Stage 6 will replace placeholderPngBlob() with the real
 * scroll-and-stitch screenshot.
 */
async function runFullPageExport(
  tabId: number,
  settings: SetSettingsPayload,
): Promise<RunFullPageExportResponse> {
  startKeepAlive();
  let exportTabId = tabId;
  canceledFullPageTabs.delete(tabId);
  // Capture the export tab's URL at start so we can detect mid-export
  // navigation (the #1 cause of "Page failed to load." with no other
  // diagnostic). Lovable editor pages are handed off to their rendered
  // preview tab before this point, so the exported HTML/CSS/JS/screenshot are
  // from the actual app, not the IDE shell.
  let startUrl = "";
  // Diagnostic phase tracker — surfaced in the error `detail` so future
  // failures pinpoint exactly which step blew up.
  const phase = { name: "boot", attempt: 0 };
  const setPhase = (name: string, attempt = 0): void => { phase.name = name; phase.attempt = attempt; };
  try {
  // Original brief: Export Full Page works on any http(s):// site the user
  // is currently viewing. No host allow/block list, no preview-tab redirect.
  // The only URLs we can't touch are ones Chrome physically forbids scripting
  // (chrome://, chrome-extension://, edge://, about:, view-source:,
  // devtools://, file://, the Web Store). Those surface naturally via
  // ensureContentScript → E_NOT_AVAILABLE_HERE below.
  exportTabId = tabId;
  try {
    const t = await chrome.tabs.get(tabId);
    startUrl = t?.url ?? "";
  } catch { /* tab gone — let later steps fail with a real error */ }
  await makeTabVisibleForCapture(exportTabId);

  await broadcast({ status: PanelStatus.Collecting });

  // Proactively wait for the page to be `complete` and the CS to be
  // reachable before the first collect. Skipping this is the most common
  // cause of "page failed to load" errors when the user hits Export Full
  // Page on a still-loading or just-navigated tab.
  setPhase("ensureContentScript:pre-collect");
  try {
    await ensureContentScript(exportTabId);
  } catch (e) {
    logger.warn(LogCategory.Capture, ErrorCode.E_NOT_AVAILABLE_HERE, "pre-collect content script readiness failed; retrying during collect", e);
  }

  let artifacts: CollectPageArtifactsResponse;
  const collect = (): Promise<CollectPageArtifactsResponse> =>
    withTimeout(
      sendToTab<{ tabId: number }, CollectPageArtifactsResponse>(
        exportTabId, MessageKind.CollectPageArtifacts, { tabId: exportTabId },
      ),
      COLLECT_TIMEOUT_MS,
      "collect artifacts",
    );
  const isTransient = (msg: string): boolean =>
    /Receiving end does not exist|Could not establish connection|page failed to load|message port closed/i.test(msg);
  try {
    // Retry transient failures with backoff. The CS may need extra time
    // to mount on slow pages or pages doing late hydration.
    const delays = [0, 300, 700, 1200, 2000, 3000];
    let lastErr: unknown;
    artifacts = undefined as unknown as CollectPageArtifactsResponse;
    for (let i = 0; i < delays.length; i++) {
      throwIfFullPageCanceled(exportTabId);
      if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
      throwIfFullPageCanceled(exportTabId);
      try {
        setPhase("collect", i + 1);
        artifacts = await collect();
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        const m = err instanceof Error ? err.message : String(err);
        const d = err instanceof MessageError ? (err.detail ?? m) : m;
        if (!isTransient(m) && !isTransient(d)) throw err;
        logger.warn(LogCategory.Capture, "COLLECT_RETRY", `attempt ${i + 1} failed; re-injecting CS`, err);
        try { await ensureContentScript(exportTabId); } catch { /* keep retrying */ }
      }
    }
    if (lastErr) throw lastErr;
  } catch (e) {
    // Preserve already-translated MessageError (e.g. E_NOT_AVAILABLE_HERE
    // raised by sendToTab when the page is still loading or the CS isn't
    // reachable). Re-wrapping would mask the real cause and surface a
    // generic "Page failed to load." with E_PERMISSION_DENIED.
    if (e instanceof MessageError) {
      await maybeAttachNavigationDetail(e, exportTabId, startUrl, phase);
      throw e;
    }
    const msg = e instanceof Error ? e.message : String(e);
    // chrome.tabs.sendMessage rejects with this exact phrase when the CS
    // isn't injected (chrome://, edge://, file://, new tab, Web Store, PDFs).
    if (/Receiving end does not exist|Could not establish connection|page failed to load|tab was closed|frame .* removed|message port closed/i.test(msg)) {
      throw new MessageError(
        ErrorCode.E_NOT_AVAILABLE_HERE,
        "This page can't be exported right now. Wait for it to finish loading, reload the tab, or open a regular http(s):// site and try again.",
        msg,
      );
    }
    if (/timed out/i.test(msg)) {
      throw new MessageError(
        ErrorCode.E_COLLECT_TIMEOUT,
        "Page took too long to collect. Try a smaller page or use Pick Element.",
        msg,
      );
    }
    throw new MessageError(
      ErrorCode.E_COLLECT_TIMEOUT,
      "Could not collect page artifacts",
      msg,
    );
  }

  // ---- Screenshot (Stage 6) ----
  const tab = await chrome.tabs.get(exportTabId);
  setPhase("captureFullPage");
  const screenshot = await captureFullPage({
    tabId: exportTabId,
    windowId: tab.windowId,
    pageCssPx: artifacts.meta.pageCssPx,
    viewportCssPx: artifacts.meta.viewportCssPx,
    dpr: artifacts.meta.devicePixelRatio,
    format: settings?.imageFormat ?? "png",
    jpegQuality: settings?.jpegQuality ?? 90,
    onPhase: setPhase,
    onProgress: (p) => {
      if (p.progress) setPhase("capture:frame", p.progress.done);
      return broadcast(p);
    },
    recoverTabMessaging: ensureContentScript,
    isCanceled: () => canceledFullPageTabs.has(exportTabId),
  });

  throwIfFullPageCanceled(exportTabId);
  // Update captureFrames count in meta now that we know it.
  const finalMeta = {
    ...artifacts.meta,
    counts: { ...artifacts.meta.counts, captureFrames: screenshot.framesPlaced },
  };

  await broadcast({ status: PanelStatus.Bundling });
  const bundle = await buildBundle({
    html: artifacts.html,
    css: artifacts.css,
    js: artifacts.js,
    pngBlob: screenshot.blob,
    meta: finalMeta,
  });

  const filename = applyTemplate(
    settings?.namingTemplateFullPage ?? "inspect-page-fullpage-{domain}-{timestamp}.zip",
    {
      domain: domainFromUrl(artifacts.meta.url),
      timestamp: localTimestamp(),
    },
  );

  await broadcast({ status: PanelStatus.Downloading });
  // MV3 service workers don't expose URL.createObjectURL — use a data URL.
  const url = await blobToDataUrl(bundle);
  let downloadId: number;
  try {
    downloadId = await chrome.downloads.download({ url, filename, saveAs: true });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_DOWNLOAD_FAILED, "chrome.downloads failed",
      e instanceof Error ? e.message : String(e),
    );
  }
  logger.info(LogCategory.Download, `bundle saved as ${filename} (id=${downloadId})`);
  // Toast notification — the popup may have closed during capture, so this
  // is the user's confirmation that the download succeeded.
  try {
    chrome.notifications?.create?.(`inspect-page:done:${downloadId}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/128.png"),
      title: "Inspect Page",
      message: `Saved ${filename}`,
      priority: 1,
    });
  } catch { /* notifications permission optional */ }
  const screenshotDataUrl = await blobToDataUrl(screenshot.blob);
  const response: RunFullPageExportResponse = {
    bundleFilename: filename,
    downloadId,
    telemetry: finalMeta.counts,
    artifacts: {
      html: artifacts.html,
      css: artifacts.css,
      js: artifacts.js,
      screenshotDataUrl,
      meta: finalMeta,
    },
  };
  await broadcast({
    status: PanelStatus.Success,
    message: filename,
    telemetry: response.telemetry,
    fullPageArtifacts: response.artifacts,
  });
  return response;
  } catch (e) {
    const err = mapFullPageExportError(e);
    if (err.detail === "user-canceled") {
      await broadcast({ status: PanelStatus.Idle });
      throw err;
    }
    await maybeAttachNavigationDetail(err, exportTabId, startUrl, phase);
    await broadcast({
      status: PanelStatus.Error,
      message: err.message,
      errorCode: err.code,
      errorDetail: err.detail,
    });
    throw err;
  } finally {
    canceledFullPageTabs.delete(exportTabId);
    stopKeepAlive();
  }
}

function throwIfFullPageCanceled(tabId: number): void {
  if (!canceledFullPageTabs.has(tabId)) return;
  throw new MessageError(ErrorCode.E_EXPORT_INTERRUPTED, "Export canceled.", "user-canceled");
}

function mapFullPageExportError(e: unknown): MessageError {
  if (e instanceof MessageError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/page failed to load|Receiving end does not exist|Could not establish connection|tab was closed|frame .* removed|message port closed/i.test(msg)) {
    return new MessageError(
      ErrorCode.E_NOT_AVAILABLE_HERE,
      "This page can't be exported right now. Reload the tab and try again, or open a regular http(s):// site.",
      msg,
    );
  }
  if (/timed out/i.test(msg)) {
    return new MessageError(ErrorCode.E_EXPORT_TIMEOUT, "Export took too long. Try a smaller page or use Pick Element.", msg);
  }
  return new MessageError(ErrorCode.E_EXPORT_INTERRUPTED, "Export failed before it could finish. Reload the tab and try again.", msg);
}


async function makeTabVisibleForCapture(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) await chrome.tabs.update(tabId, { active: true });
  } catch {
    // Let the normal export path surface a phase-tagged tab error.
  }
}

/**
 * If the tab navigated away (or closed) during the export, rewrite the error
 * surface so the user sees the real cause instead of the generic "open a
 * regular http(s):// site" message. We mutate in place because callers have
 * already thrown/broadcast the reference.
 */
async function maybeAttachNavigationDetail(
  err: MessageError,
  tabId: number,
  startUrl: string,
  phase?: { name: string; attempt: number },
): Promise<void> {
  const baseDetail = (err as { detail?: string }).detail ?? "";
  const phaseTag = phase ? `phase=${phase.name}${phase.attempt ? `#${phase.attempt}` : ""}` : "";
  let tab: chrome.tabs.Tab | null = null;
  try { tab = await chrome.tabs.get(tabId); } catch { /* gone */ }
  const nowUrl = tab?.url ?? "";
  const status = tab?.status ?? "missing";
  const diag = [
    phaseTag,
    `tabStatus=${status}`,
    startUrl ? `startUrl=${truncUrl(startUrl)}` : "",
    nowUrl && nowUrl !== startUrl ? `nowUrl=${truncUrl(nowUrl)}` : "",
  ].filter(Boolean).join(" | ");
  (err as { detail?: string }).detail = [baseDetail, diag].filter(Boolean).join(" || ");
  if (err.code !== ErrorCode.E_NOT_AVAILABLE_HERE) return;
  if (!tab) {
    (err as { message: string }).message =
      "The tab was closed before export finished. Reopen the page and try again.";
    return;
  }
  if (startUrl && nowUrl && nowUrl !== startUrl) {
    (err as { message: string }).message =
      "The page navigated during export. Stay on the same page and try again.";
  } else if (status !== "complete") {
    (err as { message: string }).message =
      "The page is still loading. Wait until it finishes and try again.";
  }
}

function truncUrl(u: string): string { return u.length > 120 ? `${u.slice(0, 117)}…` : u; }



async function broadcast(payload: StatusUpdatePayload): Promise<void> {
  // Best-effort; popup may not be open. Errors swallowed.
  try {
    await chrome.runtime.sendMessage({
      kind: MessageKind.StatusUpdate,
      requestId: `bcast_${Date.now()}`,
      payload,
    });
  } catch {
    // Popup closed.
  }
}

/**
 * Wrap a promise with a timeout. Rejects with `<label> timed out after Nms`
 * so the caller can map it to E_COLLECT_TIMEOUT cleanly.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Probe `/wp-json/inspect-page/v1/auth-status` on the saved WP site, persist the
 * latest identity + nonce, and return a panel-friendly summary. Public route
 * so it works with the WP cookie alone (no nonce needed yet).
 */
async function checkShareAuth(): Promise<CheckShareAuthResponse> {
  const cfg = await getShareSettings();
  const empty: CheckShareAuthResponse = {
    loggedIn: false, userId: 0, displayName: "", email: "", nonce: "",
  };
  if (!cfg.siteUrl) return empty;
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/auth-status`;
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include" });
  } catch {
    return empty;
  }
  if (!res.ok) return empty;
  let json: {
    logged_in: boolean; user_id?: number; display_name?: string;
    email?: string; nonce?: string;
    quota?: {
      active: number; max_active: number;
      hourly_used: number; max_hourly: number;
      lifetime_used?: number; free_limit?: number; has_license?: boolean;
    };
  };
  try { json = await res.json(); } catch { return empty; }
  if (!json.logged_in) {
    await setShareSettings({ userId: 0, displayName: "", email: "", nonce: "", signedInAtIso: "" });
    return empty;
  }
  await setShareSettings({
    userId: json.user_id ?? 0,
    displayName: json.display_name ?? "",
    email: json.email ?? "",
    nonce: json.nonce ?? "",
    signedInAtIso: new Date().toISOString(),
  });
  return {
    loggedIn: true,
    userId: json.user_id ?? 0,
    displayName: json.display_name ?? "",
    email: json.email ?? "",
    nonce: json.nonce ?? "",
    quota: json.quota ? {
      active: json.quota.active,
      maxActive: json.quota.max_active,
      hourlyUsed: json.quota.hourly_used,
      maxHourly: json.quota.max_hourly,
      lifetimeUsed: json.quota.lifetime_used ?? 0,
      freeLimit: json.quota.free_limit ?? 5,
      hasLicense: json.quota.has_license ?? false,
    } : undefined,
  };
}

