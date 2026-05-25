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
} from "@shared/constants";
import { LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { buildPickerDom } from "./picker-dom";
import { updateOverlay, showTarget } from "./picker-overlay";
import { collectInjectedOverlays, isInjectedOverlay } from "@inspect/overlay-filter";

export interface PickerHandlers {
  onSelect(detail: { element: Element; rect: DOMRect }): void | Promise<void>;
  onCancel(): void;
  /**
   * Phase 1 multi-pick: invoked when the user clicks the floating "Done" bar
   * after toggling 1..MAX_PICKS elements. If absent, the picker falls back to
   * calling `onSelect` for each element sequentially.
   */
  onCommit?(elements: Element[]): void | Promise<void>;
}

/** Hard cap on simultaneously-picked elements. */
export const MAX_PICKS = 11;

export interface PickerState {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  box: HTMLDivElement;
  marginBox: HTMLDivElement;
  paddingBox: HTMLDivElement;
  size: HTMLDivElement;       // size text inside chip
  chip: HTMLDivElement;       // P1: chip group with size + action icons
  chipBtnSelect: HTMLButtonElement;
  chipBtnCopy: HTMLButtonElement;
  chipBtnCancel: HTMLButtonElement;
  chipFlash: HTMLSpanElement; // ephemeral "Copied" tag
  chipHover: boolean;         // suppress overlay updates while pointer is on chip
  currentTarget: Element | null; // last highlighted element (used by chip buttons)
  badges: HTMLDivElement[]; // [top, right, bottom, left] padding badges
  mBadges: HTMLDivElement[]; // [top, right, bottom, left] margin badges
  tip: HTMLDivElement;
  guides: HTMLDivElement[];   // [top, right, bottom, left] distance lines
  gBadges: HTMLDivElement[];  // [top, right, bottom, left] distance labels
  altDown: boolean;
  lastX: number;
  lastY: number;
  navTarget: Element | null;  // B4: keyboard-navigated element (overrides cursor)
  prevCursor: string;
  rafScheduled: boolean;
  pendingEvent: PointerEvent | MouseEvent | null;
  // Phase 1 multi-pick
  selections: Element[];
  selLayer: HTMLDivElement;
  bar: HTMLDivElement;
  barDone: HTMLButtonElement;
  barCancel: HTMLButtonElement;
  barCount: HTMLSpanElement;
  toast: HTMLDivElement;
  toastTimer: number | null;
  onScrollOrResize: () => void;
  cleanup: () => void;
}

const HOST_ID = "inspect-page-picker-host";
let state: PickerState | null = null;


export function isPickerActive(): boolean {
  return state !== null;
}

export function enterPicker(handlers: PickerHandlers): void {
  if (state) return;

  // v2.7.10 — Fix #1: only mount the picker chrome in the top frame.
  // The content script runs in every frame (all_frames: true), so without
  // this guard each iframe (Lovable preview, ads, embeds) instantiated its
  // own picker. Two overlays + two chips + two Done bars fought over the
  // cursor and the highlight appeared to "jump" between elements. Iframe
  // contents are still pickable from the top frame via deepElementFromPoint.
  try {
    if (window.top !== window) return;
  } catch {
    // Cross-origin top access denied → we're inside an iframe, bail.
    return;
  }

  const dom = buildPickerDom();

  const prevCursor = document.body?.style.cursor ?? "";
  if (document.body) document.body.style.cursor = "crosshair";

  // ---- listeners ----
  const onMove = (e: PointerEvent | MouseEvent): void => {
    if (!state) return;
    // Don't re-target while pointer is over our chip — keeps chip stable
    // and prevents the highlighted element from changing under the cursor.
    if (state.chipHover) return;
    // Cursor moved → resume cursor-driven highlight, clear keyboard lock.
    if (state.navTarget) state.navTarget = null;
    state.pendingEvent = e;
    if (state.rafScheduled) return;
    state.rafScheduled = true;
    requestAnimationFrame(() => {
      if (!state) return;
      state.rafScheduled = false;
      const evt = state.pendingEvent;
      state.pendingEvent = null;
      if (!evt) return;
      const target = pickTarget(evt.clientX, evt.clientY);
      updateOverlay(state, evt.clientX, evt.clientY, target);
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
    // Don't hijack right-clicks on our chip either.
    if (e.composedPath().includes(dom.chip)) return;
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
    // Any click that lands inside the picker's own shadow host (chip, bar,
    // tooltip, sel ring) belongs to picker UI — never swallow it, never
    // re-target the host page underneath.
    if (e.composedPath().includes(dom.host)) return;
    // Let chip-button clicks through to their own handlers.
    if (e.composedPath().includes(dom.chip)) return;
    // Let bar-button clicks through to their own handlers.
    if (e.composedPath().includes(dom.bar)) return;
    e.preventDefault(); e.stopPropagation();
    const target = pickTarget(e.clientX, e.clientY);
    if (!target) {
      // v2.7.6 — surface a hint so the user knows the picker is still active
      // after clicking a non-pickable region (iframe gap, blank area, overlay).
      showToast("Not pickable — try another element");
      return;
    }
    // Phase 1: toggle into multi-pick selections; commit happens on Done.
    toggleSelection(target);
  };

  // P1: short-circuit overlay re-targeting while pointer is on the chip
  const onChipEnter = (): void => { if (state) state.chipHover = true; };
  const onChipLeave = (): void => { if (state) state.chipHover = false; };
  dom.chip.addEventListener("pointerenter", onChipEnter);
  dom.chip.addEventListener("pointerleave", onChipLeave);

  // P2: chip button handlers — operate on the last highlighted target.
  const fireSelect = (e: Event): void => {
    e.preventDefault(); e.stopPropagation();
    const t = state?.currentTarget ?? null;
    if (!t) return;
    // Chip ✓ — Phase 1: add hovered element to selection (toggle).
    toggleSelection(t);
  };
  const fireCopy = async (e: Event): Promise<void> => {
    e.preventDefault(); e.stopPropagation();
    const t = state?.currentTarget ?? null;
    if (!t) return;
    const sel = chipShortSelector(t);
    try { await navigator.clipboard.writeText(sel); } catch { /* ignore */ }
    if (state) {
      state.chipFlash.style.display = "inline-block";
      window.setTimeout(() => {
        if (state) state.chipFlash.style.display = "none";
      }, 1100);
    }
    logger.info(LogCategory.Picker, "Copied selector via chip", sel);
  };
  const fireCancel = (e: Event): void => {
    e.preventDefault(); e.stopPropagation();
    handlers.onCancel();
    exitPicker();
  };
  dom.chipBtnSelect.addEventListener("click", fireSelect);
  dom.chipBtnCopy.addEventListener("click", (e) => { void fireCopy(e); });
  dom.chipBtnCancel.addEventListener("click", fireCancel);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      handlers.onCancel();
      exitPicker();
      return;
    }
    if ((e.key === "Alt" || e.altKey) && state && !state.altDown) {
      state.altDown = true;
      // v2.7.10 — Fix #7: if Alt is pressed before the user has moved
      // the mouse, lastX/lastY are still -1 and updateOverlay would paint
      // off-screen. Skip the repaint until we have real coordinates.
      if (state.lastX >= 0 && state.lastY >= 0) {
        const t = state.navTarget ?? pickTarget(state.lastX, state.lastY);
        updateOverlay(state, state.lastX, state.lastY, t);
      }
    }
    if (!state) return;
    const navKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
    if (!navKeys.includes(e.key)) return;
    // v2.7.10 — Fix #5: don't hijack arrow / Enter keys when focus is in
    // the floating panel (inputs, selects, textareas, buttons) or in any
    // editable host-page field. e.target gets retargeted to the shadow
    // host, but `closest` doesn't always match across shadow boundaries
    // reliably depending on the path, so use composedPath() + activeElement.
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    const inPanel = path.some((n) => {
      const el = n as HTMLElement | null;
      return !!(el && el.nodeType === 1 && (el.id === "inspect-page-panel-host" || el.id === HOST_ID));
    });
    if (inPanel) return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae) {
      const tag = ae.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || ae.isContentEditable) return;
      if (ae.id === "inspect-page-panel-host") return;
    }
    e.preventDefault(); e.stopPropagation();
    const current = state.navTarget ?? pickTarget(state.lastX, state.lastY);
    if (!current) return;
    if (e.key === "Enter") {
      const rect = current.getBoundingClientRect();
      void Promise.resolve(handlers.onSelect({ element: current, rect })).catch((err) => {
        logger.warn(LogCategory.Picker, "SELECT_FAIL", "select handler threw", err);
      });
      return;
    }
    const next = walkDom(current, e.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight");
    if (!next) return;
    state.navTarget = next;
    showTarget(state, next);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Alt" && state && state.altDown) {
      state.altDown = false;
      if (state.lastX >= 0 && state.lastY >= 0) {
        const t = state.navTarget ?? pickTarget(state.lastX, state.lastY);
        updateOverlay(state, state.lastX, state.lastY, t);
      }
    }
  };

  window.addEventListener("mousemove", onMoveThrottled, true);
  window.addEventListener("mouseover", onMoveThrottled, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);

  const onScrollOrResize = (): void => { renderSelections(); };
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize, true);

  const fireDone = (e: Event): void => {
    e.preventDefault(); e.stopPropagation();
    if (!state || state.selections.length === 0) return;
    const els = state.selections.slice();
    if (handlers.onCommit) {
      void Promise.resolve(handlers.onCommit(els)).catch((err) => {
        logger.warn(LogCategory.Picker, "COMMIT_FAIL", "commit handler threw", err);
      });
    } else {
      for (const el of els) {
        const r = el.getBoundingClientRect();
        void Promise.resolve(handlers.onSelect({ element: el, rect: r })).catch((err) => {
          logger.warn(LogCategory.Picker, "SELECT_FAIL", "select handler threw", err);
        });
      }
    }
    exitPicker();
  };
  const fireBarCancel = (e: Event): void => {
    e.preventDefault(); e.stopPropagation();
    handlers.onCancel();
    exitPicker();
  };
  dom.barDone.addEventListener("click", fireDone);
  dom.barCancel.addEventListener("click", fireBarCancel);

  const cleanup = (): void => {
    window.removeEventListener("mousemove", onMoveThrottled, true);
    window.removeEventListener("mouseover", onMoveThrottled, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
    dom.chip.removeEventListener("pointerenter", onChipEnter);
    dom.chip.removeEventListener("pointerleave", onChipLeave);
    dom.barDone.removeEventListener("click", fireDone);
    dom.barCancel.removeEventListener("click", fireBarCancel);
    if (state?.toastTimer) window.clearTimeout(state.toastTimer);
  };

  state = {
    host: dom.host, shadow: dom.shadow, box: dom.box,
    marginBox: dom.marginBox, paddingBox: dom.paddingBox, size: dom.size,
    chip: dom.chip, chipBtnSelect: dom.chipBtnSelect,
    chipBtnCopy: dom.chipBtnCopy, chipBtnCancel: dom.chipBtnCancel,
    chipFlash: dom.chipFlash,
    chipHover: false, currentTarget: null,
    badges: dom.badges, mBadges: dom.mBadges, tip: dom.tip,
    guides: dom.guides, gBadges: dom.gBadges, altDown: false,
    lastX: -1, lastY: -1, navTarget: null,
    prevCursor,
    rafScheduled: false,
    pendingEvent: null,
    selections: [], selLayer: dom.selLayer,
    bar: dom.bar, barDone: dom.barDone, barCancel: dom.barCancel,
    barCount: dom.barCount,
    toast: dom.toast, toastTimer: null, onScrollOrResize,
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

/** Phase 1 — toggle an element in/out of the multi-pick selections. */
function toggleSelection(el: Element): void {
  if (!state) return;
  const idx = state.selections.indexOf(el);
  if (idx >= 0) {
    state.selections.splice(idx, 1);
  } else {
    if (state.selections.length >= MAX_PICKS) {
      showToast(`Limit reached (${MAX_PICKS})`);
      return;
    }
    state.selections.push(el);
  }
  state.barDone.disabled = state.selections.length === 0;
  state.barCount.textContent = `${state.selections.length} / ${MAX_PICKS}`;
  renderSelections();
}

/** Phase 1 — paint persistent green rings + numbered badges for each pick. */
function renderSelections(): void {
  if (!state) return;
  const layer = state.selLayer;
  layer.textContent = "";
  state.selections.forEach((el, i) => {
    let r: DOMRect;
    try { r = el.getBoundingClientRect(); } catch { return; }
    if (r.width === 0 && r.height === 0) return;
    const ring = document.createElement("div");
    ring.className = "lpe-pk-sel-ring";
    ring.style.left = `${r.left}px`;
    ring.style.top = `${r.top}px`;
    ring.style.width = `${r.width}px`;
    ring.style.height = `${r.height}px`;
    layer.appendChild(ring);
    const num = document.createElement("div");
    num.className = "lpe-pk-sel-num";
    num.textContent = String(i + 1);
    num.style.left = `${Math.max(2, r.left - 6)}px`;
    num.style.top = `${Math.max(2, r.top - 6)}px`;
    layer.appendChild(num);
  });
}

function showToast(msg: string): void {
  if (!state) return;
  state.toast.textContent = msg;
  state.toast.style.display = "block";
  if (state.toastTimer) window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    if (state) state.toast.style.display = "none";
  }, 1600);
}

/** Returns the host-page element under (x,y), excluding extension/Lovable overlays. */
function pickTarget(x: number, y: number): Element | null {
  if (!state) return null;
  // Hide our UI and other top-level extension/dev overlays temporarily so
  // elementFromPoint can see the actual page beneath Lovable/AI sidebars.
  const prevDisplay = state.host.style.display;
  state.host.style.display = "none";
  // v2.7.10 — Fix #4: also hide the floating panel host while probing.
  // Previously the panel host was excluded from the hide list, so clicks
  // (and right-clicks) whose coordinates landed inside the panel returned
  // the panel itself and the picker bailed out instead of selecting the
  // page element underneath. The picker `onClick`/`onContextMenu` handlers
  // already let panel UI clicks through via `closest()` before reaching
  // pickTarget, so it is safe to treat the panel as invisible here.
  const panelHost = document.getElementById("inspect-page-panel-host") as HTMLElement | null;
  const prevPanelDisplay = panelHost?.style.display ?? "";
  if (panelHost) panelHost.style.display = "none";
  const hidden = collectInjectedOverlays(document, window)
    .filter((el) => el !== state?.host && el.id !== "inspect-page-panel-host")
    .map((el) => ({ el, visibility: el.style.visibility }));
  let el: Element | null = null;
  try {
    for (const item of hidden) item.el.style.visibility = "hidden";
    el = deepElementFromPoint(document, x, y);
  } finally {
    for (const item of hidden) item.el.style.visibility = item.visibility;
    state.host.style.display = prevDisplay;
    if (panelHost) panelHost.style.display = prevPanelDisplay;
  }
  if (!el) return null;
  if (el === state.host) return null;
  // Reject anything inside our shadow host (for any other extension overlay
  // we own). The check above covers the picker; the panel host is also
  // skipped via `closest`.
  if ((el as Element).closest("#inspect-page-panel-host")) return null;
  if (isInjectedOverlay(el, window)) return null;
  return el;
}

function deepElementFromPoint(doc: Document, x: number, y: number, depth = 0): Element | null {
  const el = doc.elementFromPoint(x, y);
  if (!el || depth > 4) return el;
  if (!(el instanceof HTMLIFrameElement)) return el;
  try {
    const childDoc = el.contentDocument;
    if (!childDoc) return el;
    const r = el.getBoundingClientRect();
    return deepElementFromPoint(childDoc, x - r.left, y - r.top, depth + 1) ?? el;
  } catch {
    return el;
  }
}

/** B4: walk the DOM by arrow direction, skipping non-element nodes. */
function walkDom(
  el: Element,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
): Element | null {
  if (key === "ArrowUp") {
    const p = el.parentElement;
    if (!p || p === document.documentElement) return null;
    return p;
  }
  if (key === "ArrowDown") {
    return el.firstElementChild ?? null;
  }
  if (key === "ArrowLeft") {
    return el.previousElementSibling ?? null;
  }
  // ArrowRight
  return el.nextElementSibling ?? null;
}

export function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = Array.from(el.classList).slice(0, 3).map((c) => `.${c}`).join("");
  return `${tag}${id}${cls}`.slice(0, PICKER_TOOLTIP_MAX_CHARS);
}

/** P2: short selector for chip Copy action. Mirrors inspect/collectSnapshot. */
function chipShortSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = (typeof el.className === "string")
    ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".")
    : "";
  return cls ? `${tag}.${cls}` : tag;
}
