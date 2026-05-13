/**
 * Service worker entry. Stage 2 — message router with Ping/GetSettings/SetSettings.
 */
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, MessageRouter, sendToTab } from "@shared/messaging";
import { getPanelPosition, getSettings, setPanelPosition, setSettings } from "@shared/settings";
import { getShareSettings, normalizeBaseUrl, setShareSettings } from "@shared/shareSettings";
import { createShareSession as createShareSessionImpl } from "@share/createShareSession";
import { revokeShareSession as revokeShareSessionImpl } from "@share/revokeShareSession";
import { KEEPALIVE_INTERVAL_MS } from "@shared/constants";
import { COLLECT_TIMEOUT_MS } from "@shared/constants";
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
  OpenLoginPopupPayload,
  OpenLoginPopupResponse,
  GetShareSettingsPayload,
  GetShareSettingsResponse,
  SetShareSettingsPayload,
  SetShareSettingsResponse,
  GetSettingsPayload,
  GetSettingsResponse,
  GetPanelPositionPayload,
  GetPanelPositionResponse,
  SetPanelPositionPayload,
  SetPanelPositionResponse,
  MountFloatingPanelPayload,
  MountFloatingPanelResponse,
  PingPayload,
  PingResponse,
  RunElementExportPayload,
  RunElementExportResponse,
  RunFullPageExportPayload,
  RunFullPageExportResponse,
  SetSettingsPayload,
  SetSettingsResponse,
  StatusUpdatePayload,
} from "@shared/types";
import { PanelStatus } from "@shared/enums";
import { buildBundle } from "@zip/buildBundle";
import { applyTemplate, domainFromUrl, localTimestamp } from "@zip/filename";
import { captureFullPage } from "@capture/screenshotOrchestrator";
import { runElementExport } from "@element/runElementExport";

logger.info(LogCategory.Lifecycle, `Service worker booted v${__EXT_VERSION__}`);

const router = new MessageRouter();

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

router.on<MountFloatingPanelPayload, MountFloatingPanelResponse>(
  MessageKind.MountFloatingPanel,
  async ({ tabId }) => {
    try {
      await ensureContentScript(tabId);
      await sendToTab<{ tabId: number }, void>(tabId, MessageKind.MountFloatingPanel, { tabId });
    } catch (e) {
      throw new MessageError(
        ErrorCode.E_NOT_AVAILABLE_HERE,
        "Cannot mount panel on this page",
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
    await ensureContentScript(tid);
    return runFullPageExport(tid, settings);
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

router.attach();

/**
 * Ensure the content script is alive in the target tab. The manifest
 * `content_scripts` entry only injects on navigation — tabs already open
 * before the extension was installed/reloaded won't have it. We ping; if
 * that fails, we programmatically inject `content.js` and retry once.
 * Throws E_NOT_AVAILABLE_HERE on restricted URLs (chrome://, web store, …).
 */
async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      kind: MessageKind.Ping,
      requestId: `ensure_${Date.now()}`,
      payload: { sentAtMs: Date.now() },
    });
    return;
  } catch {
    // CS not loaded — try to inject.
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["content.js"],
    });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_NOT_AVAILABLE_HERE,
      "This page can't be exported. Open a regular http(s):// site and try again.",
      e instanceof Error ? e.message : String(e),
    );
  }
}

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

// Toolbar icon click — mount the floating panel on the active tab directly.
// (No popup is registered in the manifest, so onClicked fires.)
chrome.action?.onClicked?.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await ensureContentScript(tab.id);
    await sendToTab<{ tabId: number }, void>(
      tab.id, MessageKind.MountFloatingPanel, { tabId: tab.id },
    );
  } catch (e) {
    logger.error(
      LogCategory.Lifecycle, "ACTION_CLICK_FAIL",
      "Failed to mount floating panel from toolbar click", e,
    );
  }
});

// ---- Stage 9: SW keep-alive during exports (E20) ----
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let keepAliveCount = 0;
function startKeepAlive(): void {
  keepAliveCount++;
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo().catch(() => undefined);
  }, KEEPALIVE_INTERVAL_MS);
}
function stopKeepAlive(): void {
  keepAliveCount = Math.max(0, keepAliveCount - 1);
  if (keepAliveCount === 0 && keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

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
  try {
  await broadcast({ status: PanelStatus.Collecting });

  let artifacts: CollectPageArtifactsResponse;
  try {
    artifacts = await withTimeout(
      sendToTab<{ tabId: number }, CollectPageArtifactsResponse>(
        tabId, MessageKind.CollectPageArtifacts, { tabId },
      ),
      COLLECT_TIMEOUT_MS,
      "collect artifacts",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // chrome.tabs.sendMessage rejects with this exact phrase when the CS
    // isn't injected (chrome://, edge://, file://, new tab, Web Store, PDFs).
    if (/Receiving end does not exist|Could not establish connection/i.test(msg)) {
      throw new MessageError(
        ErrorCode.E_NOT_AVAILABLE_HERE,
        "This page can't be exported. Open a regular http(s):// site and try again.",
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
  const tab = await chrome.tabs.get(tabId);
  const screenshot = await captureFullPage({
    tabId,
    windowId: tab.windowId,
    pageCssPx: artifacts.meta.pageCssPx,
    viewportCssPx: artifacts.meta.viewportCssPx,
    dpr: artifacts.meta.devicePixelRatio,
    format: settings?.imageFormat ?? "png",
    jpegQuality: settings?.jpegQuality ?? 90,
    onProgress: (p) => broadcast(p),
  });

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
  } finally {
    stopKeepAlive();
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Chunked btoa to avoid call-stack overflow on large bundles.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  const b64 = btoa(binary);
  return `data:application/zip;base64,${b64}`;
}

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

