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
  CAPTURE_TAB_READY_TIMEOUT_MS,
  CAPTURE_GAP_MS, CAPTURE_RETRY_MAX, FRAME_SETTLE_MS,
  SCROLL_STEP_TIMEOUT_MS,
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
  onPhase?: (phase: string, attempt?: number) => void;
  onProgress?: (p: StatusUpdatePayload) => void | Promise<void>;
  recoverTabMessaging?: (tabId: number) => Promise<void>;
  isCanceled?: () => boolean;
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
  tabId: number, windowId: number, format: ImageFormat, quality: number,
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= CAPTURE_RETRY_MAX; attempt++) {
    try {
      await ensureTabReadyForVisibleCapture(tabId, windowId);
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

async function ensureTabReadyForVisibleCapture(tabId: number, windowId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    } else {
      await chrome.windows.update(windowId, { focused: true }).catch(() => undefined);
    }
    if (!tab.active) await chrome.tabs.update(tabId, { active: true }).catch(() => undefined);
  } catch {
    // Capture will surface the real tab/window failure below.
  }

  const deadline = Date.now() + CAPTURE_TAB_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") break;
    } catch {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, CAPTURE_GAP_MS));
  }
  await new Promise((resolve) => setTimeout(resolve, CAPTURE_GAP_MS));
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
      throwIfCanceled(input);
      const requestedY = Math.min(i * viewportCssPx.h, Math.max(0, effectivePageH - viewportCssPx.h));
      const scrollPayload = { y: requestedY, viewportHeight: viewportCssPx.h, settleMs: FRAME_SETTLE_MS };

      input.onPhase?.("capture:scroll", i + 1);
      const scroll = await withTimeout(scrollFrame(input, scrollPayload, i + 1), SCROLL_STEP_TIMEOUT_MS, `scroll capture frame ${i + 1}`);

      input.onPhase?.("capture:visible", i + 1);
      const wait = lastCaptureAt + CAPTURE_GAP_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      const dataUrl = await captureVisibleTabWithRetry(tabId, windowId, format, jpegQuality);
      lastCaptureAt = Date.now();

      input.onPhase?.("capture:stitch-frame", i + 1);
      const yPx = Math.round(scroll.actualY * dpr);
      const res = await sendOffscreen<typeof addPayload, OffscreenAddFrameResponse>(
        MessageKind.OffscreenAddFrame, (addPayload = { dataUrl, xPx: 0, yPx, sessionId }),
      );
      framesPlaced = res.framesPlaced;

      await input.onProgress?.({
        status: PanelStatus.Capturing,
        progress: { done: i + 1, total: steps },
      });
      throwIfCanceled(input);
    }

    throwIfCanceled(input);
    input.onPhase?.("capture:finish-stitch");
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
      input.onPhase?.("capture:restore");
      await executeRestoreAfterCaptureFallback(input.tabId);
    } catch (fallbackErr) {
      logger.warn(LogCategory.Capture, "RESTORE_FALLBACK_FAIL", "Direct restore fallback failed", fallbackErr);
    }
    try {
      await sendToTabWithRecovery<{ requestId: string }, RestoreAfterCaptureResponse>(
        input, MessageKind.RestoreAfterCapture, { requestId: sessionId }, "restore after capture",
      );
    } catch (e) {
      logger.warn(LogCategory.Capture, "RESTORE_FAIL", "Content-script restore failed", e);
    }
    try {
      await sendOffscreen<{ sessionId: string }, void>(MessageKind.OffscreenDispose, { sessionId });
    } catch { /* ignore */ }
  }
}

async function scrollFrame(
  input: ScreenshotInput,
  scrollPayload: { y: number; viewportHeight: number; settleMs: number },
  frame: number,
): Promise<BeginScrollCaptureResponse> {
  // Root cause fix: some SPA-heavy sites (LeetCode included) intermittently
  // make chrome.tabs.sendMessage reject with "The page failed to load" even
  // while chrome.tabs.get(tabId).status is already "complete". For scroll
  // capture, a registered content-script listener is not required; direct
  // chrome.scripting.executeScript is more reliable and bypasses that stale
  // messaging channel. Keep the old content-script path only as a fallback.
  try {
    return await executeBeginScrollCaptureFallback(input.tabId, scrollPayload);
  } catch (fallbackErr) {
    logger.warn(LogCategory.Capture, ErrorCode.E_NOT_AVAILABLE_HERE, `scroll capture frame ${frame} direct script failed; trying content-script messaging`, fallbackErr);
  }

  return sendToTabWithRecovery<
        { y: number; viewportHeight: number; settleMs: number },
        BeginScrollCaptureResponse
      >(
        input,
        MessageKind.BeginScrollCapture,
        scrollPayload,
        `scroll capture frame ${frame}`,
        () => executeBeginScrollCaptureFallback(input.tabId, scrollPayload),
      );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function throwIfCanceled(input: ScreenshotInput): void {
  if (!input.isCanceled?.()) return;
  throw new MessageError(ErrorCode.E_EXPORT_INTERRUPTED, "Export canceled.", "user-canceled");
}

async function sendToTabWithRecovery<P, R>(
  input: ScreenshotInput,
  kind: MessageKind,
  payload: P,
  label: string,
  fallback?: () => Promise<R>,
): Promise<R> {
  // Widened from 4 → 6 attempts (~7.4s budget) so slow re-hydrating pages
  // get enough room to recover before we surface E_NOT_AVAILABLE_HERE.
  const delays = [0, 300, 700, 1200, 2000, 3000];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      return await sendToTab<P, R>(input.tabId, kind, payload);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const detail = e instanceof MessageError ? (e.detail ?? msg) : msg;
      if (!TRANSIENT_TAB_MESSAGE_RE.test(msg) && !TRANSIENT_TAB_MESSAGE_RE.test(detail)) throw e;
      logger.warn(LogCategory.Capture, ErrorCode.E_NOT_AVAILABLE_HERE, `${label} transient tab message failure; retry ${i + 1}`, e);
      if (fallback) {
        try { return await fallback(); } catch (fallbackErr) { logger.warn(LogCategory.Capture, ErrorCode.E_NOT_AVAILABLE_HERE, `${label} script fallback failed`, fallbackErr); }
      }
      await input.recoverTabMessaging?.(input.tabId).catch(() => undefined);
    }
  }
  throw lastErr ?? new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, `${label} failed`);
}

async function executeBeginScrollCaptureFallback(
  tabId: number,
  payload: { y: number; viewportHeight: number; settleMs: number },
): Promise<BeginScrollCaptureResponse> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    func: async (p) => {
      const key = "__inspectPageCaptureFallbackState";
      const page = window as typeof window & { __inspectPageCaptureFallbackState?: { x: number; y: number; behavior: string; stuck: Array<[HTMLElement, string]>; overlays: Array<[HTMLElement, string]> } };
      if (!page[key]) {
        // Hide Inspect Page own hosts + foreign extension overlays FIRST
        // (display:none so they leave zero pixels in the screenshot).
        const overlays: Array<[HTMLElement, string]> = [];
        const OVERLAY_SEL = "#inspect-page-panel-host,#inspect-page-picker-host,[id^='inspect-page-'][id$='-host']";
        const HIGH_Z = 2147480000;
        const hideOverlay = (el: HTMLElement): void => {
          overlays.push([el, el.style.cssText]);
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("visibility", "hidden", "important");
        };
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_SEL))) hideOverlay(el);
        const rootChildren: Element[] = [];
        if (document.body) rootChildren.push(...Array.from(document.body.children));
        if (document.documentElement) {
          for (const c of Array.from(document.documentElement.children)) {
            if (c !== document.body) rootChildren.push(c);
          }
        }
        for (const node of rootChildren) {
          const el = node as HTMLElement;
          if (!el || el.nodeType !== 1) continue;
          if (overlays.some(([h]) => h === el)) continue;
          let injected = false;
          if (el.tagName.includes("-")) injected = true;
          if (!injected) {
            let cs: CSSStyleDeclaration | null = null;
            try { cs = window.getComputedStyle(el); } catch { cs = null; }
            const pos = cs?.position ?? "";
            const fixedish = pos === "fixed" || pos === "sticky";
            if (fixedish && el.shadowRoot) injected = true;
            if (!injected && fixedish) {
              const z = Number(cs?.zIndex);
              if (Number.isFinite(z) && z >= HIGH_Z) injected = true;
            }
          }
          if (injected) hideOverlay(el);
        }
        const stuck: Array<[HTMLElement, string]> = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
          if (!(el instanceof HTMLElement)) continue;
          if (overlays.some(([h]) => h === el)) continue;
          const position = getComputedStyle(el).position;
          if (position === "fixed" || position === "sticky") {
            stuck.push([el, el.style.cssText]);
            el.style.setProperty("visibility", "hidden", "important");
          }
        }
        page[key] = {
          x: window.scrollX,
          y: window.scrollY,
          behavior: document.documentElement.style.scrollBehavior,
          stuck,
          overlays,
        };
        document.documentElement.style.scrollBehavior = "auto";
      }
      window.scrollTo({ top: p.y, left: 0, behavior: "auto" });
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await new Promise((resolve) => setTimeout(resolve, p.settleMs));
      return { actualY: window.scrollY, dpr: window.devicePixelRatio };
    },
    args: [payload],
  });
  return result.result ?? { actualY: payload.y, dpr: 1 };
}

async function executeRestoreAfterCaptureFallback(tabId: number): Promise<RestoreAfterCaptureResponse> {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    func: () => {
      const key = "__inspectPageCaptureFallbackState";
      const page = window as typeof window & { __inspectPageCaptureFallbackState?: { x: number; y: number; behavior: string; stuck: Array<[HTMLElement, string]> } };
      const state = page[key];
      if (!state) return;
      for (const [el, cssText] of state.stuck) el.style.cssText = cssText;
      document.documentElement.style.scrollBehavior = state.behavior;
      window.scrollTo(state.x, state.y);
      delete page[key];
    },
  });
}

// Workaround for narrowing: addPayload is reused across loop iterations.
// (Declared at module scope so the type parameter to sendOffscreen can read it.)
let addPayload: { dataUrl: string; xPx: number; yPx: number; sessionId: string };
