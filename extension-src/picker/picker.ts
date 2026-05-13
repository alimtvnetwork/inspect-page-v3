/**
 * Element picker — Stage 7. Source: spec/21-app/04-element-picker.md.
 *
 * Mounts a fixed full-viewport overlay in its own Shadow DOM under <html>,
 * tracks pointer to highlight `elementFromPoint`, right-click selects.
 *
 * Stage 7 scope: highlight + selection callback. The selection handler
 * receives the chosen element + rect; the actual MD pipeline lands in Stage 8.
 */
import {
  PICKER_THROTTLE_MS,
  PICKER_TOOLTIP_MAX_CHARS,
  Z_INDEX_PICKER,
} from "@shared/constants";
import { LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";

export interface PickerHandlers {
  onSelect(detail: { element: Element; rect: DOMRect }): void | Promise<void>;
  onCancel(): void;
}

interface PickerState {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  box: HTMLDivElement;
  tip: HTMLDivElement;
  prevCursor: string;
  rafScheduled: boolean;
  pendingEvent: PointerEvent | MouseEvent | null;
  cleanup: () => void;
}

const HOST_ID = "inspect-page-picker-host";
let state: PickerState | null = null;

const STYLE = `
:host { all: initial; }
.lpe-pk-box {
  position: fixed; pointer-events: none;
  outline: 2px solid #0969da;
  background: rgba(9,105,218,0.12);
  z-index: ${Z_INDEX_PICKER};
  transition: none;
  display: none;
}
.lpe-pk-tip {
  position: fixed; pointer-events: none;
  background: #0d1117; color: #f6f8fa;
  font: 12px ui-sans-serif, system-ui, sans-serif;
  padding: 4px 6px; border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  z-index: ${Z_INDEX_PICKER};
  white-space: nowrap; max-width: 80vw; overflow: hidden;
  display: none;
}
`;

export function isPickerActive(): boolean {
  return state !== null;
}

export function enterPicker(handlers: PickerHandlers): void {
  if (state) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = `position:fixed;inset:0;width:0;height:0;pointer-events:none;z-index:${Z_INDEX_PICKER};`;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = STYLE;
  shadow.appendChild(styleEl);

  const box = document.createElement("div");
  box.className = "lpe-pk-box";
  shadow.appendChild(box);

  const tip = document.createElement("div");
  tip.className = "lpe-pk-tip";
  shadow.appendChild(tip);

  const prevCursor = document.body?.style.cursor ?? "";
  if (document.body) document.body.style.cursor = "crosshair";

  // ---- listeners ----
  const onMove = (e: PointerEvent | MouseEvent): void => {
    if (!state) return;
    state.pendingEvent = e;
    if (state.rafScheduled) return;
    state.rafScheduled = true;
    requestAnimationFrame(() => {
      if (!state) return;
      state.rafScheduled = false;
      const evt = state.pendingEvent;
      state.pendingEvent = null;
      if (!evt) return;
      updateOverlay(evt.clientX, evt.clientY);
    });
  };

  // Throttle floor: avoid sub-PICKER_THROTTLE_MS bursts on touchpads.
  let lastTs = 0;
  const onMoveThrottled = (e: PointerEvent | MouseEvent): void => {
    const now = performance.now();
    if (now - lastTs < PICKER_THROTTLE_MS) return;
    lastTs = now;
    onMove(e);
  };

  const onContextMenu = (e: MouseEvent): void => {
    // Don't hijack right-clicks on our own floating panel — let the user
    // interact with Cancel / Close / Minimize while picker is active.
    const t = e.target as Element | null;
    if (t?.closest?.("#inspect-page-panel-host")) return;
    e.preventDefault(); e.stopPropagation();
    const target = pickTarget(e.clientX, e.clientY);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    void Promise.resolve(handlers.onSelect({ element: target, rect })).catch((err) => {
      logger.warn(LogCategory.Picker, "SELECT_FAIL", "select handler threw", err);
    });
  };

  const onClick = (e: MouseEvent): void => {
    // Let clicks on our own floating panel through (Cancel picker button,
    // Close, Minimize, Settings, etc.). Only consume host-page clicks so
    // the page doesn't navigate while the picker is active.
    const t = e.target as Element | null;
    if (t?.closest?.("#inspect-page-panel-host")) return;
    e.preventDefault(); e.stopPropagation();
    // Treat a left-click as a selection too (in addition to right-click)
    // so the picker is discoverable without needing the context menu.
    const target = pickTarget(e.clientX, e.clientY);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    void Promise.resolve(handlers.onSelect({ element: target, rect })).catch((err) => {
      logger.warn(LogCategory.Picker, "SELECT_FAIL", "select handler threw", err);
    });
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    handlers.onCancel();
    exitPicker();
  };

  window.addEventListener("mousemove", onMoveThrottled, true);
  window.addEventListener("mouseover", onMoveThrottled, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKeyDown, true);

  const cleanup = (): void => {
    window.removeEventListener("mousemove", onMoveThrottled, true);
    window.removeEventListener("mouseover", onMoveThrottled, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKeyDown, true);
  };

  state = {
    host, shadow, box, tip,
    prevCursor,
    rafScheduled: false,
    pendingEvent: null,
    cleanup,
  };

  logger.info(LogCategory.Picker, "Picker active");
}

export function exitPicker(): void {
  if (!state) return;
  state.cleanup();
  if (document.body) document.body.style.cursor = state.prevCursor;
  state.host.remove();
  state = null;
  logger.info(LogCategory.Picker, "Picker exited");
}

/** Returns the host-page element under (x,y), excluding our overlay host. */
function pickTarget(x: number, y: number): Element | null {
  if (!state) return null;
  // hide our overlay temporarily so elementFromPoint can see what's beneath.
  const prevDisplay = state.host.style.display;
  state.host.style.display = "none";
  const el = document.elementFromPoint(x, y);
  state.host.style.display = prevDisplay;
  if (!el) return null;
  if (el === state.host) return null;
  // Reject anything inside our shadow host (for any other extension overlay
  // we own). The check above covers the picker; the panel host is also
  // skipped via `closest`.
  if ((el as Element).closest("#inspect-page-panel-host")) return null;
  return el;
}

function updateOverlay(x: number, y: number): void {
  if (!state) return;
  const target = pickTarget(x, y);
  if (!target) {
    state.box.style.display = "none";
    state.tip.style.display = "none";
    return;
  }
  const r = target.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    state.box.style.display = "none";
    state.tip.style.display = "none";
    return;
  }
  state.box.style.left = `${r.left}px`;
  state.box.style.top = `${r.top}px`;
  state.box.style.width = `${r.width}px`;
  state.box.style.height = `${r.height}px`;
  state.box.style.display = "block";

  state.tip.textContent = describe(target);
  state.tip.style.display = "block";
  // Position: prefer cursor + (12,12), flip if overflows.
  const tipRect = state.tip.getBoundingClientRect();
  let tx = x + 12;
  let ty = y + 12;
  if (tx + tipRect.width > window.innerWidth) tx = x - 12 - tipRect.width;
  if (ty + tipRect.height > window.innerHeight) ty = y - 12 - tipRect.height;
  state.tip.style.left = `${Math.max(0, tx)}px`;
  state.tip.style.top = `${Math.max(0, ty)}px`;
}

export function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = Array.from(el.classList).slice(0, 3).map((c) => `.${c}`).join("");
  return `${tag}${id}${cls}`.slice(0, PICKER_TOOLTIP_MAX_CHARS);
}
