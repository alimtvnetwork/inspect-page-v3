/**
 * Mounts <ExportPanel surface="floating"/> into a Shadow DOM under <body>.
 * Idempotent: a second call focuses the existing panel instead of duplicating.
 * Source: spec/21-app/02-ui-panel.md §A2, §H, §I.
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { STORAGE_WRITE_DEBOUNCE_MS, Z_INDEX_PANEL } from "@shared/constants";
import { sendToBackground } from "@shared/messaging";
import type {
  GetPanelPositionResponse,
  SetPanelPositionPayload,
  SetPanelPositionResponse,
} from "@shared/types";
import { ExportPanel } from "./ExportPanel";
import panelCss from "./styles.css?raw";
import { clamp } from "./clamp";
export { clamp } from "./clamp";

const HOST_ID = "inspect-page-panel-host";
const DEFAULT_PANEL_W = 520;
const DEFAULT_PANEL_H = 720;
const MIN_PANEL_W = 480;
const MIN_PANEL_H = 560;
const MAX_PANEL_W = 720;
const MAX_PANEL_H = 900;
const PANEL_GUTTER = 16;

interface MountedPanel {
  host: HTMLElement;
  root: Root;
  cleanup: () => void;
}

let mounted: MountedPanel | null = null;

export function mountFloatingPanel(): void {
  if (mounted) {
    // Re-focus existing panel.
    mounted.host.style.display = "block";
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 0",
    "height: 0",
    `z-index: ${Z_INDEX_PANEL}`,
    "pointer-events: none",
  ].join(";");
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = panelCss;
  shadow.appendChild(styleEl);

  const wrapper = document.createElement("div");
  const initialW = clamp(DEFAULT_PANEL_W, 320, Math.max(320, window.innerWidth - PANEL_GUTTER * 2));
  const initialH = clamp(DEFAULT_PANEL_H, 420, Math.max(420, window.innerHeight - PANEL_GUTTER * 2));
  wrapper.style.cssText = [
    "position: fixed",
    "pointer-events: auto",
    `width: ${initialW}px`,
    `height: ${initialH}px`,
  ].join(";");
  shadow.appendChild(wrapper);

  const root = createRoot(wrapper);
  const cleanup = installDrag(wrapper);
  const cleanupResize = installResize(wrapper);

  // Restore persisted position (best-effort, async).
  void sendToBackground<Record<string, never>, GetPanelPositionResponse>(
    MessageKind.GetPanelPosition, {},
  ).then((pos) => {
    if (!pos) return;
    if (pos.minimized) {
      host.style.display = "none";
      showRestorePill();
      return;
    }
    const maxW = Math.min(MAX_PANEL_W, Math.max(320, window.innerWidth - PANEL_GUTTER * 2));
    const maxH = Math.min(MAX_PANEL_H, Math.max(420, window.innerHeight - PANEL_GUTTER * 2));
    const minW = Math.min(MIN_PANEL_W, maxW);
    const minH = Math.min(MIN_PANEL_H, maxH);
    if (typeof pos.wPx === "number") {
      wrapper.style.width = `${clamp(pos.wPx, minW, maxW)}px`;
    }
    if (typeof pos.hPx === "number") {
      wrapper.style.height = `${clamp(pos.hPx, minH, maxH)}px`;
    }
    const w = wrapper.getBoundingClientRect().width || 320;
    const h = wrapper.getBoundingClientRect().height || 240;
    wrapper.style.left = `${clamp(pos.xPx, 0, window.innerWidth - w)}px`;
    wrapper.style.top = `${clamp(pos.yPx, 0, window.innerHeight - h)}px`;
  }).catch(() => undefined);

  let pillEl: HTMLDivElement | null = null;
  const showRestorePill = (): void => {
    if (pillEl) return;
    pillEl = document.createElement("div");
    pillEl.id = "inspect-page-restore-pill";
    pillEl.style.cssText = [
      "position: fixed",
      "bottom: 16px",
      "right: 16px",
      `z-index: ${Z_INDEX_PANEL}`,
      "background: #1f6feb",
      "color: #fff",
      "font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      "padding: 8px 12px",
      "border-radius: 999px",
      "box-shadow: 0 4px 14px rgba(0,0,0,0.25)",
      "cursor: pointer",
      "user-select: none",
    ].join(";");
    pillEl.textContent = "Inspect Page";
    pillEl.setAttribute("role", "button");
    pillEl.setAttribute("aria-label", "Restore Inspect Page panel");
    pillEl.addEventListener("click", () => {
      host.style.display = "block";
      void persistPosition({ minimized: false }).catch(() => undefined);
      pillEl?.remove();
      pillEl = null;
    });
    document.documentElement.appendChild(pillEl);
  };

  const close = (): void => {
    try { root.unmount(); } catch { /* ignore */ }
    cleanup();
    cleanupResize();
    host.remove();
    pillEl?.remove();
    pillEl = null;
    mounted = null;
    void persistPosition({ minimized: false }).catch(() => undefined);
  };

  const minimize = (): void => {
    host.style.display = "none";
    showRestorePill();
    void persistPosition({ minimized: true }).catch(() => undefined);
  };

  const popOut = (): void => {
    try {
      const url = chrome.runtime?.getURL?.("popup/index.html");
      if (!url) return;
      void chrome.windows?.create?.({
        url, type: "popup", width: 540, height: 760, focused: true,
      });
      // Migrate to detached window — tear down in-page panel so we don't keep two surfaces.
      close();
    } catch { /* ignore */ }
  };

  root.render(
    <StrictMode>
      <ExportPanel
        surface="floating"
        activeUrl={location.href}
        onMinimize={minimize}
        onClose={close}
        onPopOut={popOut}
      />
    </StrictMode>,
  );

  mounted = { host, root, cleanup: () => { cleanup(); cleanupResize(); } };
  logger.info(LogCategory.Lifecycle, "Floating panel mounted");
}

export function unmountFloatingPanel(): void {
  if (!mounted) return;
  try { mounted.root.unmount(); } catch { /* ignore */ }
  mounted.cleanup();
  mounted.host.remove();
  mounted = null;
}

// ---- Drag implementation ----
//
// We attach a pointerdown listener to the wrapper and only act when the
// originating element has data-drag-handle="true" (the panel header). The
// position is read from the wrapper's inline `top`/`left` and clamped to
// the viewport. The pointerup persists via SetSettings (debounced upstream).

function installDrag(wrapper: HTMLElement): () => void {
  // Initial position: top-right with 16px gutter; size estimated at the readable default width.
  const startW = wrapper.getBoundingClientRect().width || DEFAULT_PANEL_W;
  const startX = Math.max(0, window.innerWidth - startW - PANEL_GUTTER);
  wrapper.style.top = `${PANEL_GUTTER}px`;
  wrapper.style.left = `${startX}px`;

  let dragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startPanelX = 0;
  let startPanelY = 0;
  let pointerId = -1;

  const onDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    // Don't start a drag when the user is interacting with controls inside
    // the header (close, minimize, etc.). preventDefault() on those would
    // swallow the subsequent click.
    if (target?.closest("button, a, input, select, textarea, [role='button']")) {
      return;
    }
    const handle = target?.closest("[data-drag-handle='true']") as HTMLElement | null;
    if (!handle) return;
    dragging = true;
    pointerId = e.pointerId;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startPanelX = parseFloat(wrapper.style.left || "0");
    startPanelY = parseFloat(wrapper.style.top || "0");
    handle.setPointerCapture?.(pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;
    const rect = wrapper.getBoundingClientRect();
    const x = clamp(startPanelX + dx, 0, window.innerWidth - rect.width);
    const y = clamp(startPanelY + dy, 0, window.innerHeight - rect.height);
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    pointerId = -1;
    const x = parseFloat(wrapper.style.left || "0");
    const y = parseFloat(wrapper.style.top || "0");
    schedulePersist({ xPx: x, yPx: y, minimized: false });
  };
  const onResize = (): void => {
    const rect = wrapper.getBoundingClientRect();
    const x = clamp(parseFloat(wrapper.style.left || "0"), 0, window.innerWidth - rect.width);
    const y = clamp(parseFloat(wrapper.style.top || "0"), 0, window.innerHeight - rect.height);
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
    schedulePersist({ xPx: x, yPx: y });
  };

  wrapper.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("resize", onResize);

  return () => {
    wrapper.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("resize", onResize);
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistQueued: Partial<{ xPx: number; yPx: number; wPx: number; hPx: number; minimized: boolean }> = {};
function schedulePersist(patch: Partial<{ xPx: number; yPx: number; wPx: number; hPx: number; minimized: boolean }>): void {
  persistQueued = { ...persistQueued, ...patch };
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const payload = persistQueued;
    persistQueued = {};
    persistTimer = null;
    void persistPosition(payload).catch(() => undefined);
  }, STORAGE_WRITE_DEBOUNCE_MS);
}

async function persistPosition(
  patch: Partial<{ xPx: number; yPx: number; wPx: number; hPx: number; minimized: boolean }>,
): Promise<void> {
  await sendToBackground<SetPanelPositionPayload, SetPanelPositionResponse>(
    MessageKind.SetPanelPosition, patch,
  );
}


/**
 * Phase A12 — South-east resize handle.
 *
 * Listens for pointerdown on `[data-resize-handle="true"]` inside the
 * wrapper and resizes within [MIN_PANEL_W, MAX_PANEL_W] × [MIN_PANEL_H, MAX_PANEL_H],
 * clamped to the viewport. Persists wPx/hPx via the same debounced channel
 * as the drag.
 */
function installResize(wrapper: HTMLElement): () => void {
  let resizing = false;
  let startW = 0, startH = 0, startX = 0, startY = 0;
  let pointerId = -1;

  const onDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement | null;
    const handle = target?.closest("[data-resize-handle='true']") as HTMLElement | null;
    if (!handle) return;
    resizing = true;
    pointerId = e.pointerId;
    const rect = wrapper.getBoundingClientRect();
    startW = rect.width;
    startH = rect.height;
    startX = e.clientX;
    startY = e.clientY;
    handle.setPointerCapture?.(pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const onMove = (e: PointerEvent): void => {
    if (!resizing) return;
    const left = parseFloat(wrapper.style.left || "0");
    const top = parseFloat(wrapper.style.top || "0");
    const maxW = Math.min(MAX_PANEL_W, Math.max(320, window.innerWidth - left));
    const maxH = Math.min(MAX_PANEL_H, Math.max(420, window.innerHeight - top));
    const minW = Math.min(MIN_PANEL_W, maxW);
    const minH = Math.min(MIN_PANEL_H, maxH);
    const w = clamp(startW + (e.clientX - startX), minW, maxW);
    const h = clamp(startH + (e.clientY - startY), minH, maxH);
    wrapper.style.width = `${w}px`;
    wrapper.style.height = `${h}px`;
  };
  const onUp = (): void => {
    if (!resizing) return;
    resizing = false;
    pointerId = -1;
    const rect = wrapper.getBoundingClientRect();
    schedulePersist({ wPx: Math.round(rect.width), hPx: Math.round(rect.height) });
  };

  wrapper.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  return () => {
    wrapper.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
}
