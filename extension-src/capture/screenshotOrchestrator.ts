/**
 * Service-worker screenshot orchestrator.
 * Source: spec/21-app/06-screenshot-strategy.md §B.
 *
 * Owns: offscreen lifecycle, scroll loop, captureVisibleTab+retry, stitch,
 * RestoreAfterCapture (always called via finally).
 *
 * Inputs: tabId, windowId, sizing, settings.
 * Output: Blob containing the stitched PNG/JPEG.
 */
import {
  CAPTURE_GAP_MS, CAPTURE_RETRY_MAX, FRAME_SETTLE_MS,
  STITCH_MAX_H_PX, STITCH_MAX_W_PX,
} from "@shared/constants";
import { ErrorCode, LogCategory, MessageKind, PanelStatus } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, makeRequestId, sendToTab } from "@shared/messaging";
import type {
  BeginScrollCaptureResponse,
  ImageFormat,
  OffscreenAddFrameResponse,
  OffscreenInitResponse,
  OffscreenStitchFinishResponse,
  RestoreAfterCaptureResponse,
  StatusUpdatePayload,
} from "@shared/types";

export interface ScreenshotInput {
  tabId: number;
  windowId: number;
  pageCssPx: { w: number; h: number };
  viewportCssPx: { w: number; h: number };
  dpr: number;
  format: ImageFormat;
  jpegQuality: number;
  onProgress?: (p: StatusUpdatePayload) => void | Promise<void>;
  recoverTabMessaging?: (tabId: number) => Promise<void>;
}
export interface ScreenshotOutput {
  blob: Blob;
  framesPlaced: number;
  widthPx: number;
  heightPx: number;
}

const OFFSCREEN_URL = "offscreen.html";
let offscreenReady: Promise<void> | null = null;

const TRANSIENT_TAB_MESSAGE_RE = /Receiving end does not exist|Could not establish connection|page failed to load|tab was closed|frame .* removed|message port closed/i;

export async function ensureOffscreen(): Promise<void> {
  if (offscreenReady) return offscreenReady;
  offscreenReady = (async () => {
    // chrome.offscreen.hasDocument may be missing on older Chromes.
    const has = await chrome.offscreen.hasDocument?.().catch(() => false);
    if (has) return;
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
        justification: "Stitch full-page screenshot via OffscreenCanvas.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/Only a single offscreen document/i.test(msg)) {
        offscreenReady = null;
        throw e;
      }
    }
  })();
  return offscreenReady;
}

async function sendOffscreen<P, R>(kind: MessageKind, payload: P): Promise<R> {
  const env = { kind, requestId: makeRequestId(), payload };
  const res = (await chrome.runtime.sendMessage(env)) as
    | { ok: true; data: R }
    | { ok: false; error: { code: ErrorCode; message: string; detail?: string } };
  if (!res || res.ok !== true) {
    const err = res?.error ?? { code: ErrorCode.E_STITCH_FAILED, message: "no offscreen reply" };
    throw new MessageError(err.code, err.message, err.detail);
  }
  return res.data;
}

async function captureVisibleTabWithRetry(
  windowId: number, format: ImageFormat, quality: number,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= CAPTURE_RETRY_MAX; attempt++) {
    try {
      const opts: chrome.tabs.CaptureVisibleTabOptions = { format };
      if (format === "jpeg") opts.quality = quality;
      return await chrome.tabs.captureVisibleTab(windowId, opts);
    } catch (e) {
      lastErr = e;
      logger.warn(LogCategory.Capture, ErrorCode.E_CAPTURE_FAILED, `captureVisibleTab attempt ${attempt}`, e);
      await new Promise((r) => setTimeout(r, CAPTURE_GAP_MS));
    }
  }
  throw new MessageError(
    ErrorCode.E_CAPTURE_FAILED,
    "captureVisibleTab failed after retry",
    lastErr instanceof Error ? lastErr.message : String(lastErr),
  );
}

export async function captureFullPage(input: ScreenshotInput): Promise<ScreenshotOutput> {
  const { tabId, windowId, pageCssPx, viewportCssPx, dpr, format, jpegQuality } = input;

  let effectivePageH = pageCssPx.h;
  let effectivePageW = pageCssPx.w;
  let canvasW = Math.round(effectivePageW * dpr);
  let canvasH = Math.round(effectivePageH * dpr);

  // Width too wide → hard fail (we can't shrink horizontally without distortion).
  if (canvasW > STITCH_MAX_W_PX) {
    throw new MessageError(
      ErrorCode.E_PAGE_TOO_LARGE,
      `Page too wide to stitch (${canvasW}px > ${STITCH_MAX_W_PX}px). Try a narrower window or use Element export.`,
    );
  }

  // Height too tall → clamp to max canvas height and warn instead of failing.
  if (canvasH > STITCH_MAX_H_PX) {
    logger.warn(
      LogCategory.Capture,
      ErrorCode.E_PAGE_TOO_LARGE,
      `Page taller than canvas cap; truncating from ${canvasH}px to ${STITCH_MAX_H_PX}px.`,
    );
    canvasH = STITCH_MAX_H_PX;
    effectivePageH = Math.floor(STITCH_MAX_H_PX / dpr);
  }

  const sessionId = makeRequestId();
  await ensureOffscreen();
  await sendOffscreen<{ widthPx: number; heightPx: number; sessionId: string }, OffscreenInitResponse>(
    MessageKind.OffscreenInit, { widthPx: canvasW, heightPx: canvasH, sessionId },
  );

  const steps = Math.max(1, Math.ceil(effectivePageH / viewportCssPx.h));
  let framesPlaced = 0;
  let lastCaptureAt = 0;

  try {
    for (let i = 0; i < steps; i++) {
      const requestedY = Math.min(i * viewportCssPx.h, Math.max(0, effectivePageH - viewportCssPx.h));

      const scroll = await sendToTabWithRecovery<
        { y: number; viewportHeight: number; settleMs: number },
        BeginScrollCaptureResponse
      >(
        input,
        MessageKind.BeginScrollCapture,
        { y: requestedY, viewportHeight: viewportCssPx.h, settleMs: FRAME_SETTLE_MS },
        `scroll capture frame ${i + 1}`,
      );

      const wait = lastCaptureAt + CAPTURE_GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      const dataUrl = await captureVisibleTabWithRetry(windowId, format, jpegQuality);
      lastCaptureAt = Date.now();

      const yPx = Math.round(scroll.actualY * dpr);
      const res = await sendOffscreen<typeof addPayload, OffscreenAddFrameResponse>(
        MessageKind.OffscreenAddFrame, (addPayload = { dataUrl, xPx: 0, yPx, sessionId }),
      );
      framesPlaced = res.framesPlaced;

      await input.onProgress?.({
        status: PanelStatus.Capturing,
        progress: { done: i + 1, total: steps },
      });
    }

    await input.onProgress?.({ status: PanelStatus.Stitching });

    const stitch = await sendOffscreen<
      { format: ImageFormat; quality?: number; sessionId: string },
      OffscreenStitchFinishResponse
    >(MessageKind.OffscreenStitchFinish, { format, quality: jpegQuality, sessionId });

    // Fetch the blob URL (offscreen scope) into our SW scope as bytes.
    const blob = await (await fetch(stitch.blobUrl)).blob();

    return {
      blob,
      framesPlaced,
      widthPx: stitch.widthPx,
      heightPx: stitch.heightPx,
    };
  } finally {
    try {
      await sendToTabWithRecovery<{ requestId: string }, RestoreAfterCaptureResponse>(
        input, MessageKind.RestoreAfterCapture, { requestId: sessionId }, "restore after capture",
      );
    } catch (e) {
      logger.warn(LogCategory.Capture, "RESTORE_FAIL", "Restore after capture failed", e);
    }
    try {
      await sendOffscreen<{ sessionId: string }, void>(MessageKind.OffscreenDispose, { sessionId });
    } catch { /* ignore */ }
  }
}

// Workaround for narrowing: addPayload is reused across loop iterations.
// (Declared at module scope so the type parameter to sendOffscreen can read it.)
let addPayload: { dataUrl: string; xPx: number; yPx: number; sessionId: string };
