/**
 * Service worker entry. Stage 2 — message router with Ping/GetSettings/SetSettings.
 */
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, MessageRouter, sendToTab } from "@shared/messaging";
import { getSettings, setSettings } from "@shared/settings";
import type {
  CollectPageArtifactsResponse,
  EnterPickerModePayload,
  EnterPickerModeResponse,
  ExitPickerModePayload,
  ExitPickerModeResponse,
  GetSettingsPayload,
  GetSettingsResponse,
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

router.on<MountFloatingPanelPayload, MountFloatingPanelResponse>(
  MessageKind.MountFloatingPanel,
  async ({ tabId }) => {
    try {
      // The CS is declared in manifest content_scripts so it should already
      // be alive on http(s) tabs. We forward; if the tab is a disabled URL
      // the send will reject and we surface E_NOT_AVAILABLE_HERE.
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
  async ({ tabId, settings }) => runFullPageExport(tabId, settings),
);

router.on<EnterPickerModePayload, EnterPickerModeResponse>(
  MessageKind.EnterPickerMode,
  async ({ tabId }) => {
    try {
      await sendToTab<{ tabId: number }, void>(tabId, MessageKind.EnterPickerMode, { tabId });
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
  async ({ tabId }) => {
    try {
      await sendToTab<{ tabId: number }, void>(tabId, MessageKind.ExitPickerMode, { tabId });
    } catch {
      // Tab may be closed; ignore.
    }
  },
);

router.on<RunElementExportPayload, RunElementExportResponse>(
  MessageKind.RunElementExport,
  async (payload) => {
    const tab = await chrome.tabs.get(payload.tabId);
    const settings = await getSettings();
    return runElementExport(payload, {
      tab,
      settings,
      extensionVersion: __EXT_VERSION__,
      broadcast,
    });
  },
);

router.attach();

/**
 * Stage 5 orchestrator — collect artifacts via CS, build ZIP with placeholder
 * PNG, download. Stage 6 will replace placeholderPngBlob() with the real
 * scroll-and-stitch screenshot.
 */
async function runFullPageExport(
  tabId: number,
  settings: SetSettingsPayload,
): Promise<RunFullPageExportResponse> {
  await broadcast({ status: PanelStatus.Collecting });

  let artifacts: CollectPageArtifactsResponse;
  try {
    artifacts = await sendToTab<{ tabId: number }, CollectPageArtifactsResponse>(
      tabId, MessageKind.CollectPageArtifacts, { tabId },
    );
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_COLLECT_TIMEOUT,
      "Could not collect page artifacts",
      e instanceof Error ? e.message : String(e),
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
    settings?.namingTemplateFullPage ?? "llm-export-fullpage-{domain}-{timestamp}.zip",
    {
      domain: domainFromUrl(artifacts.meta.url),
      timestamp: localTimestamp(),
    },
  );

  await broadcast({ status: PanelStatus.Downloading });
  const url = await blobToObjectUrl(bundle);
  let downloadId: number;
  try {
    downloadId = await chrome.downloads.download({ url, filename, saveAs: false });
  } catch (e) {
    URL.revokeObjectURL(url);
    throw new MessageError(
      ErrorCode.E_DOWNLOAD_FAILED, "chrome.downloads failed",
      e instanceof Error ? e.message : String(e),
    );
  }

  scheduleObjectUrlRevoke(downloadId, url);
  await broadcast({ status: PanelStatus.Success, message: filename });
  logger.info(LogCategory.Download, `bundle saved as ${filename} (id=${downloadId})`);
  return { bundleFilename: filename, downloadId };
}

async function blobToObjectUrl(blob: Blob): Promise<string> {
  // SW global URL works in MV3.
  return URL.createObjectURL(blob);
}

function scheduleObjectUrlRevoke(downloadId: number, url: string): void {
  const listener = (delta: chrome.downloads.DownloadDelta): void => {
    if (delta.id !== downloadId) return;
    if (delta.state?.current === "complete" || delta.state?.current === "interrupted") {
      URL.revokeObjectURL(url);
      chrome.downloads.onChanged.removeListener(listener);
    }
  };
  chrome.downloads.onChanged.addListener(listener);
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
