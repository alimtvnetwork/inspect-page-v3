/**
 * Service worker entry. Stage 2 — message router with Ping/GetSettings/SetSettings.
 */
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, MessageRouter, makeRequestId, sendToTab } from "@shared/messaging";
import { getPanelPosition, getSettings, setPanelPosition, setSettings } from "@shared/settings";
import { getShareSettings, normalizeBaseUrl, setShareSettings } from "@shared/share-settings";
import { createShareSession as createShareSessionImpl } from "@share/create-share-session";
import { revokeShareSession as revokeShareSessionImpl } from "@share/revoke-share-session";
import { waitForDownloadPath } from "./background/downloads";
import { captureInspectThumbnail } from "./background/thumbnail";
import { sendOffscreen, blobToDataUrl } from "./background/send-offscreen";
import { ensureAllFrameContentScripts, ensureContentScript } from "./background/tab-ready";
import {
  runFullPageExport,
  canceledFullPageTabs,
} from "./background/run-full-page-export";
// keepAlive module imported transitively via runFullPageExport for its
// side-effect listeners (chrome.alarms.onAlarm + chrome.runtime.onConnect).
import "./background/keep-alive";
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
  DownloadBlobPayload,
  DownloadBlobResponse,
} from "@shared/types";
import { PanelStatus } from "@shared/enums";
import { ensureOffscreen } from "@capture/screenshot-orchestrator";
import { runElementExport } from "@element/run-element-export";

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

router.on<StatusUpdatePayload, void>(MessageKind.StatusUpdate, (payload, sender) => {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  void chrome.tabs.sendMessage(tabId, {
    kind: MessageKind.StatusUpdate,
    requestId: makeRequestId(),
    payload,
  }).catch(() => undefined);
});

router.on<EnterPickerModePayload, EnterPickerModeResponse>(
  MessageKind.EnterPickerMode,
  async ({ tabId }, sender) => {
    const tid = tabId > 0 ? tabId : sender.tab?.id;
    if (tid === undefined) {
      throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, "Cannot resolve tab for picker");
    }
    try {
      await ensureAllFrameContentScripts(tid);
      await chrome.scripting.executeScript({
        target: { tabId: tid, allFrames: true },
        func: () => {
          window.dispatchEvent(new CustomEvent("inspect-page:picker-command", { detail: { action: "enter" } }));
        },
      });
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
      await chrome.scripting.executeScript({
        target: { tabId: tid, allFrames: true },
        func: () => {
          window.dispatchEvent(new CustomEvent("inspect-page:picker-command", { detail: { action: "exit" } }));
        },
      });
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

// DownloadBlob — used by the panel/inspector "Export for AI" buttons.
// Defaults to Chrome's normal download behavior, but panel callers may pass
// `saveAs: true` when a visible location picker is part of the workflow.
router.on<DownloadBlobPayload, DownloadBlobResponse>(
  MessageKind.DownloadBlob,
  async ({ dataUrl, filename, saveAs = false }) => {
    try {
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename,
        saveAs,
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

