/**
 * Stage 5/6 Export Full Page orchestrator — moved out of background.ts per
 * R7 (file size). Owns: tab readiness, CS collect with transient-error
 * retries, scroll-and-stitch screenshot, bundle, download, broadcast lifecycle.
 */
import { ErrorCode, LogCategory, MessageKind, PanelStatus } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, sendToTab } from "@shared/messaging";
import { COLLECT_TIMEOUT_MS } from "@shared/constants";
import { buildBundle } from "@zip/build-bundle";
import { applyTemplate, domainFromUrl, localTimestamp } from "@zip/filename";
import { captureFullPage } from "@capture/screenshot-orchestrator";
import type {
  CollectPageArtifactsResponse,
  RunFullPageExportResponse,
  SetSettingsPayload,
  StatusUpdatePayload,
} from "@shared/types";
import { startKeepAlive, stopKeepAlive } from "./keep-alive";
import { ensureContentScript } from "./tab-ready";
import { blobToDataUrl } from "./send-offscreen";

/** Tabs whose in-flight full-page export has been canceled by the user. */
export const canceledFullPageTabs = new Set<number>();

const TRANSIENT_RX =
  /Receiving end does not exist|Could not establish connection|page failed to load|message port closed/i;
const FATAL_TAB_RX =
  /Receiving end does not exist|Could not establish connection|page failed to load|tab was closed|frame .* removed|message port closed/i;

type Phase = { name: string; attempt: number };

function throwIfFullPageCanceled(tabId: number): void {
  if (!canceledFullPageTabs.has(tabId)) return;
  throw new MessageError(ErrorCode.E_EXPORT_INTERRUPTED, "Export canceled.", "user-canceled");
}

function truncUrl(u: string): string { return u.length > 120 ? `${u.slice(0, 117)}…` : u; }

async function broadcast(payload: StatusUpdatePayload): Promise<void> {
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

async function makeTabVisibleForCapture(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) await chrome.tabs.update(tabId, { active: true });
  } catch {
    // Let the normal export path surface a phase-tagged tab error.
  }
}

function mapFullPageExportError(e: unknown): MessageError {
  if (e instanceof MessageError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (FATAL_TAB_RX.test(msg)) {
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

async function maybeAttachNavigationDetail(
  err: MessageError,
  tabId: number,
  startUrl: string,
  phase?: Phase,
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

async function collectArtifactsWithRetry(
  exportTabId: number,
  setPhase: (name: string, attempt?: number) => void,
): Promise<CollectPageArtifactsResponse> {
  const collect = (): Promise<CollectPageArtifactsResponse> =>
    withTimeout(
      sendToTab<{ tabId: number }, CollectPageArtifactsResponse>(
        exportTabId, MessageKind.CollectPageArtifacts, { tabId: exportTabId },
      ),
      COLLECT_TIMEOUT_MS,
      "collect artifacts",
    );
  const isTransient = (msg: string): boolean => TRANSIENT_RX.test(msg);
  const delays = [0, 300, 700, 1200, 2000, 3000];
  let lastErr: unknown;
  let artifacts: CollectPageArtifactsResponse = undefined as unknown as CollectPageArtifactsResponse;
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
  return artifacts;
}

function mapCollectError(e: unknown): never {
  if (e instanceof MessageError) throw e;
  const msg = e instanceof Error ? e.message : String(e);
  if (FATAL_TAB_RX.test(msg)) {
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
  throw new MessageError(ErrorCode.E_COLLECT_TIMEOUT, "Could not collect page artifacts", msg);
}

async function downloadBundle(bundle: Blob, filename: string): Promise<number> {
  const url = await blobToDataUrl(bundle);
  try {
    return await chrome.downloads.download({ url, filename, saveAs: false });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_DOWNLOAD_FAILED, "chrome.downloads failed",
      e instanceof Error ? e.message : String(e),
    );
  }
}

function notifyDownloadComplete(downloadId: number, filename: string): void {
  try {
    chrome.notifications?.create?.(`inspect-page:done:${downloadId}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/128.png"),
      title: "Inspect Page",
      message: `Saved ${filename}`,
      priority: 1,
    });
  } catch { /* notifications permission optional */ }
}

export async function runFullPageExport(
  tabId: number,
  settings: SetSettingsPayload,
): Promise<RunFullPageExportResponse> {
  startKeepAlive();
  let exportTabId = tabId;
  canceledFullPageTabs.delete(tabId);
  let startUrl = "";
  const phase: Phase = { name: "boot", attempt: 0 };
  const setPhase = (name: string, attempt = 0): void => { phase.name = name; phase.attempt = attempt; };
  try {
    exportTabId = tabId;
    try {
      const t = await chrome.tabs.get(tabId);
      startUrl = t?.url ?? "";
    } catch { /* tab gone — let later steps fail with a real error */ }
    await makeTabVisibleForCapture(exportTabId);

    await broadcast({ status: PanelStatus.Collecting });

    setPhase("ensureContentScript:pre-collect");
    try {
      await ensureContentScript(exportTabId);
    } catch (e) {
      logger.warn(LogCategory.Capture, ErrorCode.E_NOT_AVAILABLE_HERE, "pre-collect content script readiness failed; retrying during collect", e);
    }

    let artifacts: CollectPageArtifactsResponse;
    try {
      artifacts = await collectArtifactsWithRetry(exportTabId, setPhase);
    } catch (e) {
      if (e instanceof MessageError) {
        await maybeAttachNavigationDetail(e, exportTabId, startUrl, phase);
        throw e;
      }
      mapCollectError(e);
    }

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
      { domain: domainFromUrl(artifacts.meta.url), timestamp: localTimestamp() },
    );

    await broadcast({ status: PanelStatus.Downloading });
    const downloadId = await downloadBundle(bundle, filename);
    logger.info(LogCategory.Download, `bundle saved as ${filename} (id=${downloadId})`);
    notifyDownloadComplete(downloadId, filename);

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
