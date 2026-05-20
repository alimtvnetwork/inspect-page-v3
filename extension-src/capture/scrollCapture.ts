/**
 * Content-script side of scroll-and-stitch.
 * Source: spec/21-app/06-screenshot-strategy.md §A, §D.
 *
 * State is module-local (one capture at a time per tab). The SW guarantees
 * BeginScrollCapture is the first message of the session; first call snapshots
 * scroll position + sticky/fixed elements; subsequent calls just scroll+settle.
 */
import { FRAME_SETTLE_RAFS, STICKY_SCAN_LIMIT } from "@shared/constants";
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import type { BeginScrollCapturePayload, BeginScrollCaptureResponse } from "@shared/types";
import { collectInjectedOverlays, OVERLAY_HOST_SELECTOR } from "../inspect/overlayFilter";

interface StuckSnapshot { el: HTMLElement; prevCss: string }

interface CaptureState {
  prevScroll: { x: number; y: number };
  prevScrollBehavior: string;
  stuck: StuckSnapshot[];
  hiddenOverlays: StuckSnapshot[];
  startHref: string;
}

let state: CaptureState | null = null;

function isPositioned(el: Element): boolean {
  const cs = getComputedStyle(el);
  return cs.position === "fixed" || cs.position === "sticky";
}

function snapshotPage(): CaptureState {
  // Hide Inspect Page's own UI hosts AND foreign extension overlays FIRST,
  // using display:none so they leave zero pixels in the screenshot. We do
  // this before the sticky scan so STICKY_SCAN_LIMIT can never starve the
  // overlay-hide path on element-dense pages.
  const hiddenOverlays: StuckSnapshot[] = [];
  const hideOverlay = (el: HTMLElement): void => {
    hiddenOverlays.push({ el, prevCss: el.style.cssText });
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
  };
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(OVERLAY_HOST_SELECTOR))) {
    hideOverlay(el);
  }
  for (const el of collectInjectedOverlays(document, window)) {
    if (hiddenOverlays.some((s) => s.el === el)) continue;
    hideOverlay(el);
  }

  const all = document.querySelectorAll("*");
  const stuck: StuckSnapshot[] = [];
  const limit = Math.min(all.length, STICKY_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const el = all[i] as HTMLElement;
    if (!(el instanceof HTMLElement)) continue;
    // Already hidden as an overlay → skip.
    if (hiddenOverlays.some((s) => s.el === el)) continue;
    if (isPositioned(el)) {
      stuck.push({ el, prevCss: el.style.cssText });
      el.style.setProperty("visibility", "hidden", "important");
    }
  }
  if (all.length > STICKY_SCAN_LIMIT) {
    logger.warn(LogCategory.Capture, ErrorCode.W_STICKY_SCAN_TRUNCATED, `sticky scan capped at ${STICKY_SCAN_LIMIT}`);
  }
  const prevScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  return {
    prevScroll: { x: window.scrollX, y: window.scrollY },
    prevScrollBehavior,
    stuck,
    hiddenOverlays,
    startHref: location.href,
  };
}

function rafs(n: number): Promise<void> {
  return new Promise((resolve) => {
    let left = n;
    const tick = (): void => {
      left--;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function beginScrollCapture(
  payload: BeginScrollCapturePayload,
): Promise<BeginScrollCaptureResponse> {
  if (!state) state = snapshotPage();
  // E9 — SPA route change mid-export: abort if URL changed since snapshot.
  if (location.href !== state.startHref) {
    logger.error(LogCategory.Capture, ErrorCode.E_ROUTE_CHANGED, `href changed mid-capture`);
    throw new Error(ErrorCode.E_ROUTE_CHANGED);
  }
  window.scrollTo({ top: payload.y, left: 0, behavior: "auto" });
  await rafs(FRAME_SETTLE_RAFS);
  await sleep(payload.settleMs);
  return { actualY: window.scrollY, dpr: window.devicePixelRatio };
}

export function restoreAfterCapture(): void {
  if (!state) return;
  for (const { el, prevCss } of state.stuck) {
    el.style.cssText = prevCss;
  }
  for (const { el, prevCss } of state.hiddenOverlays) {
    el.style.cssText = prevCss;
  }
  document.documentElement.style.scrollBehavior = state.prevScrollBehavior;
  window.scrollTo(state.prevScroll.x, state.prevScroll.y);
  state = null;
}
