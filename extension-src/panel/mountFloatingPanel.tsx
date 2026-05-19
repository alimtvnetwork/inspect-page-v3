import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { GetTabZoomResponse, PanelPosition } from "@shared/types";
import { ExportPanel } from "./ExportPanel";
import { clamp } from "./clamp";
import stylesText from "./styles.css?inline";

const HOST_ID = "inspect-page-panel-host";
const TARGET_VISUAL_W = 412;
const TARGET_VISUAL_H = 820;
const EDGE_GAP = 16;

let root: Root | null = null;
let activeTabZoom = 1;

export interface MountFloatingPanelOptions {
  tabId: number;
  activeUrl: string;
}

export function mountFloatingPanel(options: MountFloatingPanelOptions): void {
  const existing = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (existing) {
    void refreshTabZoom(options.tabId).then(() => repositionExisting(existing));
    const size = getPanelCssSize(activeTabZoom);
    applyPanelFrame(existing, size.w, size.h);
    existing.style.display = "block";
    existing.style.pointerEvents = "auto";
    existing.focus({ preventScroll: true });
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
      width: var(--lpe-panel-w, 412px) !important;
      height: var(--lpe-panel-h, 820px) !important;
      transform: scale(var(--lpe-panel-scale, 1)) !important;
      transform-origin: top left !important;
      overflow: hidden !important;
    }
    ${stylesText}
  `;
  const mount = document.createElement("div");
  mount.id = "inspect-page-floating-root";
  shadow.append(style, mount);

  document.documentElement.appendChild(host);

  const place = (position?: PanelPosition): void => {
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
      wPx: TARGET_VISUAL_W,
      hPx: TARGET_VISUAL_H,
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
  const onWindowResize = (): void => place({
    xPx: host.offsetLeft,
    yPx: host.offsetTop,
    wPx: host.offsetWidth,
    hPx: host.offsetHeight,
    minimized: false,
  });
  window.addEventListener("resize", onWindowResize);

  root = createRoot(mount);
  root.render(
    <StrictMode>
      <ExportPanel
        surface="floating"
        activeUrl={options.activeUrl}
        activeTabId={options.tabId}
        onMinimize={() => { host.style.display = "none"; }}
        onClose={() => {
          window.removeEventListener("resize", onWindowResize);
          root?.unmount();
          root = null;
          host.remove();
        }}
      />
    </StrictMode>,
  );
}

function getPanelCssSize(): { w: number; h: number } {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nativeDpr = dpr >= 2.25 ? 2 : 1;
  const pageZoom = Math.max(1, dpr / nativeDpr);
  return {
    w: Math.round(TARGET_VISUAL_W / pageZoom),
    h: Math.round(TARGET_VISUAL_H / pageZoom),
  };
}

function applyPanelFrame(host: HTMLDivElement, w = TARGET_VISUAL_W, h = TARGET_VISUAL_H): void {
  host.style.setProperty("--lpe-panel-w", `${TARGET_VISUAL_W}px`);
  host.style.setProperty("--lpe-panel-h", `${TARGET_VISUAL_H}px`);
  host.style.setProperty("--lpe-panel-scale", `${w / TARGET_VISUAL_W}`);
  host.style.setProperty("min-width", `${w}px`, "important");
  host.style.setProperty("min-height", `${h}px`, "important");
  host.style.setProperty("width", `${w}px`, "important");
  host.style.setProperty("height", `${h}px`, "important");
  host.style.setProperty("max-width", `${w}px`, "important");
  host.style.setProperty("max-height", `${h}px`, "important");
  host.style.setProperty("right", "auto", "important");
  host.style.setProperty("bottom", "auto", "important");
  host.style.setProperty("transform", "none", "important");
  host.style.setProperty("overflow", "hidden", "important");
  host.style.setProperty("box-sizing", "border-box", "important");
}

function wireDrag(host: HTMLDivElement, onDone: () => void): void {
  let start: { x: number; y: number; left: number; top: number } | null = null;
  host.shadowRoot?.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
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
