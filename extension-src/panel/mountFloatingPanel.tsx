import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { PanelPosition } from "@shared/types";
import { ExportPanel } from "./ExportPanel";
import { clamp } from "./clamp";
import stylesText from "./styles.css?inline";

const HOST_ID = "inspect-page-panel-host";
const DEFAULT_W = 412;
const DEFAULT_H = 820;
const EDGE_GAP = 16;

let root: Root | null = null;

export interface MountFloatingPanelOptions {
  tabId: number;
  activeUrl: string;
}

export function mountFloatingPanel(options: MountFloatingPanelOptions): void {
  const existing = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (existing) {
    applyPanelFrame(existing);
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
    #inspect-page-floating-root { width: 412px !important; height: 820px !important; overflow: hidden !important; }
    ${stylesText}
  `;
  const mount = document.createElement("div");
  mount.id = "inspect-page-floating-root";
  shadow.append(style, mount);

  document.documentElement.appendChild(host);

  const place = (position?: PanelPosition): void => {
    const x = clamp(position?.xPx ?? window.innerWidth - DEFAULT_W - EDGE_GAP, EDGE_GAP, window.innerWidth - DEFAULT_W - EDGE_GAP);
    const y = clamp(position?.yPx ?? EDGE_GAP, EDGE_GAP, window.innerHeight - DEFAULT_H - EDGE_GAP);
    applyPanelFrame(host);
    Object.assign(host.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  };

  const persist = (): void => {
    void sendToBackground<Partial<PanelPosition>, PanelPosition>(MessageKind.SetPanelPosition, {
      xPx: Math.round(host.offsetLeft),
      yPx: Math.round(host.offsetTop),
      wPx: DEFAULT_W,
      hPx: DEFAULT_H,
      minimized: false,
    }).catch(() => undefined);
  };

  void sendToBackground<Record<string, never>, PanelPosition>(MessageKind.GetPanelPosition, {})
    .then(place)
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

function applyPanelFrame(host: HTMLDivElement, w = DEFAULT_W, h = DEFAULT_H): void {
  host.style.setProperty("min-width", `${DEFAULT_W}px`, "important");
  host.style.setProperty("min-height", `${DEFAULT_H}px`, "important");
  host.style.setProperty("width", `${w}px`, "important");
  host.style.setProperty("height", `${h}px`, "important");
  host.style.setProperty("max-width", `${DEFAULT_W}px`, "important");
  host.style.setProperty("max-height", `${DEFAULT_H}px`, "important");
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

function wireResize(host: HTMLDivElement, onDone: () => void): void {
  let start: { x: number; y: number; w: number; h: number } | null = null;
  host.shadowRoot?.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest?.("[data-resize-handle='true']")) return;
    start = { x: event.clientX, y: event.clientY, w: host.offsetWidth, h: host.offsetHeight };
    (event.target as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  host.shadowRoot?.addEventListener("pointermove", (event) => {
    if (!start) return;
    const w = clamp(start.w + event.clientX - start.x, MIN_W, window.innerWidth - host.offsetLeft - EDGE_GAP);
    const h = clamp(start.h + event.clientY - start.y, MIN_H, window.innerHeight - host.offsetTop - EDGE_GAP);
    host.style.width = `${w}px`;
    host.style.height = `${h}px`;
  });
  host.shadowRoot?.addEventListener("pointerup", () => {
    if (!start) return;
    start = null;
    onDone();
  });
}