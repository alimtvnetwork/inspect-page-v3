/**
 * Capture a JPEG thumbnail of the active tab for use in inspect previews.
 *
 * Hides our own UI hosts + foreign overlays, snapshots the visible viewport,
 * crops to the largest preview iframe when present, then restores.
 *
 * Extracted from background.ts per spec R7 (≤100 lines per file).
 */
import { makeRequestId } from "@shared/messaging";
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { ensureOffscreen } from "@capture/screenshotOrchestrator";
import { blobToDataUrl, sendOffscreen } from "./sendOffscreen";

interface ThumbnailCropRect { x: number; y: number; w: number; h: number; dpr: number }

export async function captureInspectThumbnail(tabId: number): Promise<string> {
  let thumbnailDataUrl = "";
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId === undefined) return "";
    const [prep] = await chrome.scripting.executeScript({
      target: { tabId },
      func: preparePageForInspectThumbnail,
    }).catch(() => [] as chrome.scripting.InjectionResult<ThumbnailCropRect | null>[]);
    await new Promise((r) => setTimeout(r, 120));
    thumbnailDataUrl = await chrome.tabs.captureVisibleTab(
      tab.windowId, { format: "jpeg", quality: 70 },
    );
    const crop = prep?.result ?? null;
    if (crop) thumbnailDataUrl = await cropThumbnailDataUrl(thumbnailDataUrl, crop);
  } catch (e) {
    logger.warn(LogCategory.Capture, ErrorCode.E_CAPTURE_FAILED, "inspect thumbnail capture failed", e);
  } finally {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, func: restorePageAfterInspectThumbnail });
    } catch { /* ignore restore failure */ }
  }
  return thumbnailDataUrl;
}

function preparePageForInspectThumbnail(): ThumbnailCropRect | null {
  const hostSelector = "#inspect-page-panel-host,#inspect-page-picker-host,[id^='inspect-page-'][id$='-host']";
  const HIGH_Z = 2147480000;
  const saved: Array<{ el: HTMLElement; visibility: string; display: string; pointerEvents: string }> = [];
  const hide = (el: HTMLElement): void => {
    saved.push({ el, visibility: el.style.visibility, display: el.style.display, pointerEvents: el.style.pointerEvents });
    el.style.visibility = "hidden";
    el.style.display = "none";
    el.style.pointerEvents = "none";
  };
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(hostSelector))) hide(el);
  const roots: Element[] = [];
  if (document.body) roots.push(...Array.from(document.body.children));
  if (document.documentElement) {
    for (const c of Array.from(document.documentElement.children)) {
      if (c !== document.body) roots.push(c);
    }
  }
  for (const node of roots) {
    const el = node as HTMLElement;
    if (!el || el.nodeType !== 1) continue;
    if (saved.some((s) => s.el === el)) continue;
    const tag = el.tagName;
    let isOverlayInjected = false;
    if (tag.includes("-")) isOverlayInjected = true;
    if (!isOverlayInjected) {
      let cs: CSSStyleDeclaration | null = null;
      try { cs = window.getComputedStyle(el); } catch { cs = null; }
      const pos = cs?.position ?? "";
      const fixedish = pos === "fixed" || pos === "sticky";
      if (fixedish && el.shadowRoot) isOverlayInjected = true;
      if (!isOverlayInjected && fixedish) {
        const z = Number(cs?.zIndex);
        if (Number.isFinite(z) && z >= HIGH_Z) isOverlayInjected = true;
      }
    }
    if (isOverlayInjected) hide(el);
  }
  (window as unknown as { __ipThumbHidden?: typeof saved }).__ipThumbHidden = saved;

  const vw = window.innerWidth || 0;
  const vh = window.innerHeight || 0;
  if (vw <= 0 || vh <= 0) return null;

  let best: { rect: DOMRect; score: number } | null = null;
  for (const iframe of Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"))) {
    const style = window.getComputedStyle(iframe);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
    const rect = iframe.getBoundingClientRect();
    const w = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
    const h = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    if (w < 320 || h < 240) continue;
    const area = w * h;
    const label = `${iframe.src} ${iframe.title} ${iframe.id} ${iframe.className}`.toLowerCase();
    const previewBonus = /preview|sandbox|app|canvas|lovable/.test(label) ? vw * vh : 0;
    const score = area + previewBonus;
    if (!best || score > best.score) best = { rect, score };
  }

  if (!best) return null;
  const x = Math.max(0, Math.round(best.rect.left));
  const y = Math.max(0, Math.round(best.rect.top));
  const w = Math.min(vw - x, Math.round(best.rect.width));
  const h = Math.min(vh - y, Math.round(best.rect.height));
  const areaRatio = (w * h) / (vw * vh);
  if (areaRatio < 0.3 || w < vw * 0.35 || h < vh * 0.35) return null;
  if (areaRatio > 0.92 && x < 8 && y < 8) return null;
  return { x, y, w, h, dpr: window.devicePixelRatio || 1 };
}

function restorePageAfterInspectThumbnail(): void {
  const w = window as unknown as {
    __ipThumbHidden?: Array<{ el: HTMLElement; visibility: string; display: string; pointerEvents: string }>;
  };
  for (const item of w.__ipThumbHidden ?? []) {
    item.el.style.visibility = item.visibility;
    item.el.style.display = item.display;
    item.el.style.pointerEvents = item.pointerEvents;
  }
  delete w.__ipThumbHidden;
}

async function cropThumbnailDataUrl(dataUrl: string, rect: ThumbnailCropRect): Promise<string> {
  const sessionId = makeRequestId();
  await ensureOffscreen();
  await sendOffscreen<{ widthPx: number; heightPx: number; sessionId: string }, unknown>(
    MessageKind.OffscreenInit,
    { widthPx: Math.max(1, Math.round(rect.w * rect.dpr)), heightPx: Math.max(1, Math.round(rect.h * rect.dpr)), sessionId },
  );
  try {
    await sendOffscreen<{ dataUrl: string; xPx: number; yPx: number; sessionId: string }, unknown>(
      MessageKind.OffscreenAddFrame,
      { dataUrl, xPx: -Math.round(rect.x * rect.dpr), yPx: -Math.round(rect.y * rect.dpr), sessionId },
    );
    const stitch = await sendOffscreen<
      { format: "jpeg"; quality: number; sessionId: string },
      { blobUrl: string }
    >(MessageKind.OffscreenStitchFinish, { format: "jpeg", quality: 70, sessionId });
    const blob = await (await fetch(stitch.blobUrl)).blob();
    return blobToDataUrl(blob);
  } finally {
    await sendOffscreen<{ sessionId: string }, unknown>(MessageKind.OffscreenDispose, { sessionId })
      .catch(() => undefined);
  }
}
