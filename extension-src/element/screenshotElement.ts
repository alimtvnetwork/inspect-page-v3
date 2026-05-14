/**
 * P5 — In-context screenshot. Source: spec/21-app/05-element-export.md.
 *
 * Crops the visible viewport capture to the target's bounding rect (in device
 * pixels). The CS is responsible for scrollIntoView + settle before this runs.
 */
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, makeRequestId } from "@shared/messaging";
import type { DomRect } from "@shared/types";

export interface CropInput {
  windowId: number;
  rect: DomRect;
  dpr: number;
  /** Viewport CSS px — used to clamp crops for elements larger than the visible area. */
  viewportCssPx?: { w: number; h: number };
}

/** Capture the visible tab and crop to rect via the offscreen canvas. */
export async function captureAndCrop(input: CropInput): Promise<Blob> {
  let dataUrl: string;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(input.windowId, { format: "png" });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_CAPTURE_FAILED, "captureVisibleTab failed",
      e instanceof Error ? e.message : String(e),
    );
  }

  const sessionId = makeRequestId();
  // Clamp the crop rect to the visible viewport. captureVisibleTab only ever
  // returns viewport pixels, so allocating a canvas the size of the full
  // element (which can be many thousands of px tall for "large element"
  // picks) blows past Chromium's canvas limits and produces a mostly-empty
  // PNG. Intersecting with the viewport keeps the screenshot bounded and
  // matches what the user actually saw.
  const vw = input.viewportCssPx?.w ?? input.rect.width;
  const vh = input.viewportCssPx?.h ?? input.rect.height;
  const cx = Math.max(0, input.rect.x);
  const cy = Math.max(0, input.rect.y);
  const cRight = Math.min(vw, input.rect.x + input.rect.width);
  const cBottom = Math.min(vh, input.rect.y + input.rect.height);
  const cWidthCss = Math.max(1, cRight - cx);
  const cHeightCss = Math.max(1, cBottom - cy);
  const w = Math.max(1, Math.round(cWidthCss * input.dpr));
  const h = Math.max(1, Math.round(cHeightCss * input.dpr));

  // Reuse offscreen canvas plumbing: init/empty canvas at crop size, draw the
  // captured frame at negative offset to clip, then convertToBlob.
  await sendOffscreen({ widthPx: w, heightPx: h, sessionId }, MessageKind.OffscreenInit);
  try {
    await sendOffscreen<{ dataUrl: string; xPx: number; yPx: number; sessionId: string }>(
      {
        dataUrl, sessionId,
        xPx: -Math.round(cx * input.dpr),
        yPx: -Math.round(cy * input.dpr),
      },
      MessageKind.OffscreenAddFrame,
    );
    const stitch = await sendOffscreen<{ format: "png"; sessionId: string; quality?: undefined }>(
      { format: "png", sessionId },
      MessageKind.OffscreenStitchFinish,
    );
    type Stitch = { blobUrl: string; widthPx: number; heightPx: number; bytes: number };
    return await (await fetch((stitch as unknown as Stitch).blobUrl)).blob();
  } finally {
    await sendOffscreen({ sessionId }, MessageKind.OffscreenDispose).catch(() => undefined);
  }
}

async function sendOffscreen<P>(payload: P, kind: MessageKind): Promise<unknown> {
  const env = { kind, requestId: makeRequestId(), payload };
  const res = (await chrome.runtime.sendMessage(env)) as
    | { ok: true; data: unknown }
    | { ok: false; error: { code: ErrorCode; message: string; detail?: string } };
  if (!res || res.ok !== true) {
    const err = res?.error ?? { code: ErrorCode.E_STITCH_FAILED, message: "no offscreen reply" };
    logger.error(LogCategory.Offscreen, err.code, err.message);
    throw new MessageError(err.code, err.message, err.detail);
  }
  return res.data;
}
