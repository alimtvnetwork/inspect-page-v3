import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { GetTabZoomResponse, PanelPosition } from "@shared/types";
import { ExportPanel } from "./ExportPanel";
import { clamp } from "./clamp";
import stylesText from "./styles.css?inline";

const HOST_ID = "inspect-page-panel-host";
const LAUNCHER_ID = "inspect-page-launcher-host";
const DEFAULT_VISUAL_W = 412;
const DEFAULT_VISUAL_H = 820;
const MIN_VISUAL_W = 340;
const MIN_VISUAL_H = 380;
const EDGE_GAP = 16;

let root: Root | null = null;
let activeTabZoom = 1;
let userVisualW = DEFAULT_VISUAL_W;
let userVisualH = DEFAULT_VISUAL_H;

export interface MountFloatingPanelOptions {
  tabId: number;
  activeUrl: string;
}

export function mountFloatingPanel(options: MountFloatingPanelOptions): void {
  // Guard: only mount in the top frame. The content script runs in every
  // frame (`all_frames: true`), so without this check the panel appears
  // twice on pages that embed the same app in an iframe (e.g. Lovable
  // preview).
  try {
    if (window.top !== window) return;
  } catch {
    // Cross-origin access denied → we're inside an iframe, bail out.
    return;
  }
  const existing = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (existing) {
    void refreshTabZoom(options.tabId).then(() => repositionExisting(existing));
    const size = getPanelCssSize(activeTabZoom);
    applyPanelFrame(existing, size.w, size.h);
    existing.style.display = "block";
    existing.style.pointerEvents = "auto";
    existing.focus({ preventScroll: true });
    // User asked: every time the panel opens, the Export tab should start
    // fresh (no leftover "Saved …zip" / Re-download block from a previous
    // export). Broadcast a reset event the ExportPanel listens for.
    try {
      window.dispatchEvent(new CustomEvent("inspect-page:reset-panel-state"));
    } catch { /* ignore */ }
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.tabIndex = -1;
  host.style.cssText = [
    "position:fixed",
    "z-index:2147483646",
    "pointer-events:auto",
    "background:transparent",
    "color-scheme:dark",
  ].join(";");

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; contain: layout style; }
    #inspect-page-floating-root {
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
    }
    .lpe-floating-grip {
      position: absolute; right: 0; bottom: 0;
      width: 22px; height: 22px;
      cursor: nwse-resize;
      z-index: 2147483647;
      background:
        linear-gradient(135deg,
          transparent 0 30%,
          #2DD4A8 30% 42%,
          transparent 42% 52%,
          #2DD4A8 52% 64%,
          transparent 64% 74%,
          #73FFB8 74% 86%,
          transparent 86% 100%);
      opacity: 0.95;
      border-bottom-right-radius: 10px;
      box-shadow: 0 0 0 1px rgba(45,212,168,0.35) inset;
      touch-action: none;
    }
    .lpe-floating-grip:hover { opacity: 1; box-shadow: 0 0 0 1px #73FFB8 inset; }
    .lpe-edge-resize {
      position: absolute; z-index: 2147483647; background: transparent;
    }
    .lpe-edge-resize.e { right: 0; top: 0; width: 6px; height: 100%; cursor: ew-resize; }
    .lpe-edge-resize.s { left: 0; bottom: 0; width: 100%; height: 6px; cursor: ns-resize; }
    ${stylesText}
  `;
  const mount = document.createElement("div");
  mount.id = "inspect-page-floating-root";
  const grip = document.createElement("div");
  grip.className = "lpe-floating-grip";
  grip.setAttribute("aria-label", "Resize panel");
  grip.setAttribute("title", "Drag to resize");
  const edgeE = document.createElement("div");
  edgeE.className = "lpe-edge-resize e";
  edgeE.setAttribute("aria-label", "Resize width");
  edgeE.title = "Drag to resize width";
  const edgeS = document.createElement("div");
  edgeS.className = "lpe-edge-resize s";
  edgeS.setAttribute("aria-label", "Resize height");
  edgeS.title = "Drag to resize height";
  shadow.append(style, mount, edgeE, edgeS, grip);

  document.documentElement.appendChild(host);

  const place = (position?: PanelPosition): void => {
    if (position?.wPx && position.wPx > 0) userVisualW = clamp(position.wPx, MIN_VISUAL_W, 2400);
    if (position?.hPx && position.hPx > 0) userVisualH = clamp(position.hPx, MIN_VISUAL_H, 2400);
    const size = getPanelCssSize(activeTabZoom);
    const maxX = Math.max(EDGE_GAP, window.innerWidth - size.w - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, window.innerHeight - size.h - EDGE_GAP);
    const x = clamp(position?.xPx ?? maxX, EDGE_GAP, maxX);
    const y = clamp(position?.yPx ?? EDGE_GAP, EDGE_GAP, maxY);
    applyPanelFrame(host, size.w, size.h);
    Object.assign(host.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  };

  const persist = (): void => {
    void sendToBackground<Partial<PanelPosition>, PanelPosition>(MessageKind.SetPanelPosition, {
      xPx: Math.round(host.offsetLeft),
      yPx: Math.round(host.offsetTop),
      wPx: Math.round(userVisualW),
      hPx: Math.round(userVisualH),
      minimized: false,
    }).catch(() => undefined);
  };

  void Promise.all([
    refreshTabZoom(options.tabId),
    sendToBackground<Record<string, never>, PanelPosition>(MessageKind.GetPanelPosition, {}),
  ])
    .then(([, position]) => place(position))
    .catch(() => place());

  wireDrag(host, persist);
  wireResize(host, grip, persist);
  wireEdgeResize(host, edgeE, "x", persist);
  wireEdgeResize(host, edgeS, "y", persist);
  const onWindowResize = (): void => {
    void refreshTabZoom(options.tabId).finally(() => place({
      xPx: host.offsetLeft,
      yPx: host.offsetTop,
      wPx: host.offsetWidth,
      hPx: host.offsetHeight,
      minimized: false,
    }));
  };
  window.addEventListener("resize", onWindowResize);

  root = createRoot(mount);
  root.render(
    <StrictMode>
      <ExportPanel
        surface="floating"
        activeUrl={options.activeUrl}
        activeTabId={options.tabId}
        onMinimize={() => {
          host.style.display = "none";
          showLauncher(() => {
            host.style.display = "block";
            host.focus({ preventScroll: true });
            try {
              window.dispatchEvent(new CustomEvent("inspect-page:reset-panel-state"));
            } catch { /* ignore */ }
          });
        }}
        onClose={() => {
          window.removeEventListener("resize", onWindowResize);
          root?.unmount();
          root = null;
          host.remove();
          removeLauncher();
        }}
      />
    </StrictMode>,
  );
}

function showLauncher(onRestore: () => void): void {
  removeLauncher();
  const el = document.createElement("button");
  el.id = LAUNCHER_ID;
  el.type = "button";
  el.setAttribute("aria-label", "Restore Inspect Page panel");
  el.title = "Restore Inspect Page";
  el.textContent = "↗ Inspect Page";
  el.style.cssText = [
    "all: initial",
    "position: fixed",
    "top: 16px",
    "right: 16px",
    "z-index: 2147483646",
    "padding: 8px 12px",
    "border-radius: 999px",
    "background: #111715",
    "color: #F5FFFA",
    "border: 1px solid rgba(115,255,184,0.28)",
    "font: 600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
    "box-shadow: 0 6px 20px rgba(0,0,0,0.45), 0 0 0 1px rgba(45,212,168,0.18) inset",
    "cursor: pointer",
    "pointer-events: auto",
    "user-select: none",
  ].join(";");
  el.addEventListener("click", () => {
    removeLauncher();
    onRestore();
  });
  document.documentElement.appendChild(el);
}

function removeLauncher(): void {
  const el = document.getElementById(LAUNCHER_ID);
  if (el) el.remove();
}

function getPanelCssSize(_pageZoom = 1): { w: number; h: number } {
  return {
    w: Math.round(userVisualW),
    h: Math.round(userVisualH),
  };
}

async function refreshTabZoom(tabId: number): Promise<void> {
  try {
    const res = await sendToBackground<{ tabId: number }, GetTabZoomResponse>(
      MessageKind.GetTabZoom,
      { tabId },
    );
    activeTabZoom = Number.isFinite(res.zoomFactor) && res.zoomFactor > 0 ? res.zoomFactor : 1;
  } catch {
    activeTabZoom = 1;
  }
}

function repositionExisting(host: HTMLDivElement): void {
  const size = getPanelCssSize(activeTabZoom);
  applyPanelFrame(host, size.w, size.h);
  const maxX = Math.max(EDGE_GAP, window.innerWidth - size.w - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - size.h - EDGE_GAP);
  host.style.left = `${clamp(host.offsetLeft, EDGE_GAP, maxX)}px`;
  host.style.top = `${clamp(host.offsetTop, EDGE_GAP, maxY)}px`;
}

function applyPanelFrame(host: HTMLDivElement, w = DEFAULT_VISUAL_W, h = DEFAULT_VISUAL_H): void {
  host.style.setProperty("--lpe-panel-w", `${w}px`);
  host.style.setProperty("--lpe-panel-h", `${h}px`);
  host.style.setProperty("--lpe-panel-scale", `1`);
  host.style.setProperty("width", `${w}px`, "important");
  host.style.setProperty("height", `${h}px`, "important");
  host.style.setProperty("right", "auto", "important");
  host.style.setProperty("bottom", "auto", "important");
  host.style.setProperty("transform", "none", "important");
  host.style.setProperty("overflow", "hidden", "important");
  host.style.setProperty("box-sizing", "border-box", "important");
  // Zoom-invariant inner UI: keep the floating panel's text/buttons the
  // same visual size regardless of browser zoom without changing the user's
  // chosen panel width/height. Only the mounted React UI is downscaled.
  const mount = host.shadowRoot?.getElementById("inspect-page-floating-root") as HTMLDivElement | null;
  if (mount) {
    const z = Number.isFinite(activeTabZoom) && activeTabZoom > 0 ? activeTabZoom : 1;
    mount.style.width = `${Math.round(w * z)}px`;
    mount.style.height = `${Math.round(h * z)}px`;
    mount.style.transformOrigin = "top left";
    mount.style.transform = `scale(${1 / z})`;
  }
}

function wireDrag(host: HTMLDivElement, onDone: () => void): void {
  let start: { x: number; y: number; left: number; top: number } | null = null;
  host.shadowRoot?.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.classList?.contains?.("lpe-floating-grip")) return;
    if (!target?.closest?.("[data-drag-handle='true']")) return;
    if (target.closest("button, input, select, textarea, a")) return;
    start = { x: event.clientX, y: event.clientY, left: host.offsetLeft, top: host.offsetTop };
    (event.target as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  host.shadowRoot?.addEventListener("pointermove", (event) => {
    if (!start) return;
    const left = clamp(start.left + event.clientX - start.x, EDGE_GAP, window.innerWidth - host.offsetWidth - EDGE_GAP);
    const top = clamp(start.top + event.clientY - start.y, EDGE_GAP, window.innerHeight - host.offsetHeight - EDGE_GAP);
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  });
  host.shadowRoot?.addEventListener("pointerup", () => {
    if (!start) return;
    start = null;
    onDone();
  });
}

function wireResize(host: HTMLDivElement, grip: HTMLElement, onDone: () => void): void {
  let start: { x: number; y: number; w: number; h: number } | null = null;
  grip.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    start = {
      x: event.clientX,
      y: event.clientY,
      w: host.offsetWidth,
      h: host.offsetHeight,
    };
    try { grip.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  });
  grip.addEventListener("pointermove", (event) => {
    if (!start) return;
    const cssW = clamp(
      start.w + (event.clientX - start.x),
      MIN_VISUAL_W,
      Math.max(MIN_VISUAL_W, window.innerWidth - host.offsetLeft - EDGE_GAP),
    );
    const cssH = clamp(
      start.h + (event.clientY - start.y),
      MIN_VISUAL_H,
      Math.max(MIN_VISUAL_H, window.innerHeight - host.offsetTop - EDGE_GAP),
    );
    userVisualW = Math.round(cssW);
    userVisualH = Math.round(cssH);
    applyPanelFrame(host, cssW, cssH);
  });
  const end = (event: PointerEvent): void => {
    if (!start) return;
    start = null;
    try { grip.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    onDone();
  };
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
}

function wireEdgeResize(
  host: HTMLDivElement,
  handle: HTMLElement,
  axis: "x" | "y",
  onDone: () => void,
): void {
  let start: { x: number; y: number; w: number; h: number } | null = null;
  handle.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    event.preventDefault();
    start = {
      x: event.clientX,
      y: event.clientY,
      w: host.offsetWidth,
      h: host.offsetHeight,
    };
    try { handle.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  });
  handle.addEventListener("pointermove", (event) => {
    if (!start) return;
    let w = start.w;
    let h = start.h;
    if (axis === "x") {
      w = clamp(
        start.w + (event.clientX - start.x),
        MIN_VISUAL_W,
        Math.max(MIN_VISUAL_W, window.innerWidth - host.offsetLeft - EDGE_GAP),
      );
    } else {
      h = clamp(
        start.h + (event.clientY - start.y),
        MIN_VISUAL_H,
        Math.max(MIN_VISUAL_H, window.innerHeight - host.offsetTop - EDGE_GAP),
      );
    }
    userVisualW = Math.round(w);
    userVisualH = Math.round(h);
    applyPanelFrame(host, w, h);
  });
  const end = (event: PointerEvent): void => {
    if (!start) return;
    start = null;
    try { handle.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    onDone();
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
