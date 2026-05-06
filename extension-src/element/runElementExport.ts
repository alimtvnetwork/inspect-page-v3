/**
 * SW orchestrator for element export. Source: spec/21-app/05.
 *
 * Receives the CS payload (selector, outerHTML, matched CSS, computed diff,
 * isolated HTML, rect), captures + crops the in-context screenshot, asks the
 * offscreen doc to render the isolated screenshot, builds the .md (with
 * progressive degradation), and downloads it.
 */
import { ErrorCode, LogCategory, MessageKind, PanelStatus } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, makeRequestId } from "@shared/messaging";
import type {
  OffscreenRenderIsolatedResponse,
  RunElementExportPayload,
  RunElementExportResponse,
  Settings,
  StatusUpdatePayload,
} from "@shared/types";
import { applyTemplate, domainFromUrl, localTimestamp } from "@zip/filename";
import { blobToBase64, buildMarkdown } from "./buildMarkdown";
import { captureAndCrop } from "./screenshotElement";

interface OrchestratorEnv {
  tab: chrome.tabs.Tab;
  settings: Settings;
  url: string;
  title: string;
  viewportCssPx: { w: number; h: number };
  dpr: number;
  extensionVersion: string;
  broadcast: (p: StatusUpdatePayload) => Promise<void>;
}

export async function runElementExport(
  payload: RunElementExportPayload,
  env: OrchestratorEnv,
): Promise<RunElementExportResponse> {
  await env.broadcast({ status: PanelStatus.Selecting });

  // P5 — context screenshot.
  const contextBlob = await captureAndCrop({
    windowId: env.tab.windowId,
    rect: payload.rect,
    dpr: env.dpr,
  });
  const contextBase64 = await blobToBase64(contextBlob);

  // P6 — isolated screenshot via offscreen iframe + html-to-image.
  let isolatedBase64: string | undefined;
  try {
    const env2 = await sendOffscreen<OffscreenRenderIsolatedResponse>(
      MessageKind.OffscreenRenderIsolated,
      { html: payload.isolatedHtml, widthPx: Math.round(payload.rect.width), heightPx: Math.round(payload.rect.height) },
    );
    // env2.dataUrl is `data:image/png;base64,XYZ` — strip prefix.
    const url = env2.dataUrl;
    const comma = url.indexOf(",");
    if (comma >= 0) isolatedBase64 = url.slice(comma + 1);
  } catch (e) {
    logger.warn(LogCategory.Element, "ISOLATED_SKIP", "isolated render failed; continuing", e);
  }

  // P7 — assemble markdown.
  await env.broadcast({ status: PanelStatus.Bundling });
  const tag = payload.selectorPath.split(" > ").pop()?.replace(/[#:.].*$/, "") ?? "element";
  const md = buildMarkdown({
    url: env.url,
    title: env.title,
    capturedAtIso: new Date().toISOString(),
    viewportCssPx: env.viewportCssPx,
    dpr: env.dpr,
    selectorPath: payload.selectorPath,
    tag,
    classes: [],
    outerHtml: payload.outerHtml,
    matchedCss: payload.matchedCss,
    computedDiff: payload.computedDiff,
    contextPngBase64: contextBase64,
    ...(isolatedBase64 ? { isolatedPngBase64: isolatedBase64 } : {}),
    extensionVersion: env.extensionVersion,
    rect: payload.rect,
  });

  // P8 — download.
  await env.broadcast({ status: PanelStatus.Downloading });
  const filename = applyTemplate(env.settings.namingTemplateElement, {
    domain: domainFromUrl(env.url),
    tag,
    timestamp: localTimestamp(),
  });
  const blob = new Blob([md.md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
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
  scheduleRevoke(downloadId, url);

  await env.broadcast({ status: PanelStatus.Success, message: filename });
  logger.info(LogCategory.Download, `element md saved as ${filename} (id=${downloadId})`);
  return { mdFilename: filename, downloadId };
}

async function sendOffscreen<R>(kind: MessageKind, payload: unknown): Promise<R> {
  const env = { kind, requestId: makeRequestId(), payload };
  const res = (await chrome.runtime.sendMessage(env)) as
    | { ok: true; data: R }
    | { ok: false; error: { code: ErrorCode; message: string; detail?: string } };
  if (!res || res.ok !== true) {
    const e = res?.error ?? { code: ErrorCode.E_ISOLATED_FAILED, message: "no offscreen reply" };
    throw new MessageError(e.code, e.message, e.detail);
  }
  return res.data;
}

function scheduleRevoke(downloadId: number, url: string): void {
  const listener = (delta: chrome.downloads.DownloadDelta): void => {
    if (delta.id !== downloadId) return;
    if (delta.state?.current === "complete" || delta.state?.current === "interrupted") {
      URL.revokeObjectURL(url);
      chrome.downloads.onChanged.removeListener(listener);
    }
  };
  chrome.downloads.onChanged.addListener(listener);
}
