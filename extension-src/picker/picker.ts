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
import { contrastRatio, isLargeText, verdict } from "../inspect/contrast";

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

interface PickerState {
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

const STYLE = `
:host { all: initial; }
.lpe-pk-box {
  position: fixed; pointer-events: none;
  outline: 2px solid #7c5cff;
  background: rgba(124,92,255,0.12);
  z-index: ${Z_INDEX_PICKER};
  transition: none;
  display: none;
}
.lpe-pk-margin, .lpe-pk-padding {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  box-sizing: border-box;
}
.lpe-pk-margin { outline: 1px dashed rgba(255,165,0,0.55); background: rgba(255,165,0,0.07); }
.lpe-pk-padding { outline: 1px dashed rgba(60,200,140,0.6); background: rgba(60,200,140,0.07); }
.lpe-pk-badge {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  background: #1c1c1c; color: #f0f0f0;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 4px; border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.35);
  white-space: nowrap;
}
.lpe-pk-size {
  background: #7c5cff; color: #ffffff;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 2px 6px; border-radius: 3px;
  white-space: nowrap;
}
/* P1: chip group with size + action icons (clickable) */
.lpe-pk-chip {
  position: fixed; z-index: ${Z_INDEX_PICKER};
  display: none; align-items: center; gap: 4px;
  padding: 3px; border-radius: 5px;
  background: rgba(13,17,23,0.92); color: #f6f8fa;
  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.08);
  pointer-events: auto;
  font: 11px ui-sans-serif, system-ui, sans-serif;
}
.lpe-pk-chip-btn {
  all: unset; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 4px;
  cursor: pointer; color: #f6f8fa;
  font: 12px ui-sans-serif, system-ui, sans-serif;
}
.lpe-pk-chip-btn:hover { background: rgba(255,255,255,0.12); }
.lpe-pk-chip-btn:focus-visible { outline: 2px solid #7c5cff; outline-offset: 1px; }
.lpe-pk-chip-btn[data-variant="select"]:hover { background: rgba(60,200,140,0.25); color: #6dffb0; }
.lpe-pk-chip-btn[data-variant="cancel"]:hover { background: rgba(255,90,90,0.25); color: #ffb4b4; }
.lpe-pk-chip-flash {
  display: none; padding: 0 6px; border-radius: 3px;
  background: rgba(60,200,140,0.25); color: #6dffb0;
  font-size: 10px;
}
.lpe-pk-guide {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  background: rgba(124,92,255,0.55);
}
.lpe-pk-guide.h { height: 1px; }
.lpe-pk-guide.v { width: 1px; }
.lpe-pk-glabel {
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  background: #7c5cff; color: #ffffff;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 1px 4px; border-radius: 3px;
  white-space: nowrap;
}
.lpe-pk-tip {
  position: fixed; pointer-events: none;
  background: #0d1117; color: #f6f8fa;
  font: 12px ui-sans-serif, system-ui, sans-serif;
  padding: 10px 12px; border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.32);
  border: 1px solid rgba(255,255,255,0.08);
  z-index: ${Z_INDEX_PICKER};
  max-width: 360px; min-width: 240px;
  display: none;
}
.lpe-pk-tip b { color: #c4b5fd; font-weight: 600; }
.lpe-pk-tip i { color: #9ca3af; font-style: normal; margin-left: 6px; }
.lpe-pk-tip .lpe-pk-head { font: 600 13px ui-sans-serif, system-ui, sans-serif; color: #f6f8fa; margin-bottom: 2px; word-break: break-all; }
.lpe-pk-tip .lpe-pk-sub { font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; color: #9ca3af; margin-bottom: 8px; }
.lpe-pk-tip .lpe-pk-rows { display: grid; grid-template-columns: 88px 1fr; row-gap: 4px; column-gap: 8px; align-items: center; }
.lpe-pk-tip .lpe-pk-k { color: #9ca3af; font-size: 11px; }
.lpe-pk-tip .lpe-pk-v { color: #f6f8fa; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; display: inline-flex; align-items: center; gap: 6px; word-break: break-all; }
.lpe-pk-tip .lpe-pk-sw { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.18); flex: none; background-image: linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%); background-size: 6px 6px; background-position: 0 0, 0 3px, 3px -3px, -3px 0; }
.lpe-pk-tip .lpe-pk-sw-fill { background-image: none; }
.lpe-pk-tip .lpe-pk-pill { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.lpe-pk-tip .lpe-pk-pill.ok { background: rgba(60,200,140,0.18); color: #6dffb0; }
.lpe-pk-tip .lpe-pk-pill.warn { background: rgba(255,196,84,0.18); color: #ffd479; }
.lpe-pk-tip .lpe-pk-pill.bad { background: rgba(255,90,90,0.2); color: #ffb4b4; }
`;

const SEL_STYLE = `
.lpe-pk-sel-ring {
  position: fixed; pointer-events: none;
  outline: 2px solid #2DD4A8;
  background: rgba(45,212,168,0.10);
  z-index: ${Z_INDEX_PICKER};
  box-sizing: border-box;
}
.lpe-pk-sel-num {
  position: fixed; pointer-events: none;
  background: linear-gradient(135deg,#2DD4A8,#73FFB8);
  color: #0B0F0E;
  font: 700 11px ui-monospace, SFMono-Regular, Menlo, monospace;
  min-width: 18px; height: 18px; line-height: 18px;
  padding: 0 5px; border-radius: 9px; text-align: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  z-index: ${Z_INDEX_PICKER};
}
.lpe-pk-bar {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
  z-index: ${Z_INDEX_PICKER};
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 10px;
  background: rgba(13,17,23,0.94); color: #F5FFFA;
  border: 1px solid rgba(45,212,168,0.35);
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
  font: 12px ui-sans-serif, system-ui, sans-serif;
  pointer-events: auto;
}
.lpe-pk-bar-count { color: #9ca3af; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 0 4px; }
.lpe-pk-bar-btn {
  all: unset; box-sizing: border-box; cursor: pointer;
  padding: 4px 10px; border-radius: 6px;
  font: 600 12px ui-sans-serif, system-ui, sans-serif;
}
.lpe-pk-bar-btn[data-variant="done"] {
  background: linear-gradient(135deg,#2DD4A8,#73FFB8); color: #0B0F0E;
}
.lpe-pk-bar-btn[data-variant="done"]:disabled { opacity: 0.4; cursor: not-allowed; }
.lpe-pk-bar-btn[data-variant="cancel"] { color: #ffb4b4; }
.lpe-pk-bar-btn[data-variant="cancel"]:hover { background: rgba(255,90,90,0.18); }
.lpe-pk-toast {
  position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
  z-index: ${Z_INDEX_PICKER};
  padding: 6px 12px; border-radius: 8px;
  background: rgba(255,90,90,0.92); color: #fff;
  font: 600 12px ui-sans-serif, system-ui, sans-serif;
  box-shadow: 0 6px 18px rgba(0,0,0,0.45);
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

  const marginBox = document.createElement("div");
  marginBox.className = "lpe-pk-margin";
  shadow.appendChild(marginBox);

  const paddingBox = document.createElement("div");
  paddingBox.className = "lpe-pk-padding";
  shadow.appendChild(paddingBox);

  const size = document.createElement("div");
  size.className = "lpe-pk-size";
  // (size now lives inside the chip group below)

  // P1: chip group — size badge + action icons (Select / Copy / Cancel)
  const chip = document.createElement("div");
  chip.className = "lpe-pk-chip";
  chip.appendChild(size);

  const mkChipBtn = (label: string, glyph: string, variant: string): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lpe-pk-chip-btn";
    b.dataset.variant = variant;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.textContent = glyph;
    return b;
  };
  const chipBtnSelect = mkChipBtn("Select element", "✓", "select");
  const chipBtnCopy = mkChipBtn("Copy selector", "⧉", "copy");
  const chipBtnCancel = mkChipBtn("Cancel picker", "✕", "cancel");
  const chipFlash = document.createElement("span");
  chipFlash.className = "lpe-pk-chip-flash";
  chipFlash.textContent = "Copied";
  chip.append(chipBtnSelect, chipBtnCopy, chipBtnCancel, chipFlash);
  shadow.appendChild(chip);

  const mkBadge = (): HTMLDivElement => {
    const b = document.createElement("div");
    b.className = "lpe-pk-badge";
    shadow.appendChild(b);
    return b;
  };
  const badges = [mkBadge(), mkBadge(), mkBadge(), mkBadge()];
  const mBadges = [mkBadge(), mkBadge(), mkBadge(), mkBadge()];

  const mkGuide = (orient: "h" | "v"): HTMLDivElement => {
    const g = document.createElement("div");
    g.className = `lpe-pk-guide ${orient}`;
    shadow.appendChild(g);
    return g;
  };
  // [top, right, bottom, left] — top/bottom are vertical lines, left/right are horizontal
  const guides = [mkGuide("v"), mkGuide("h"), mkGuide("v"), mkGuide("h")];
  const mkGLabel = (): HTMLDivElement => {
    const l = document.createElement("div");
    l.className = "lpe-pk-glabel";
    shadow.appendChild(l);
    return l;
  };
  const gBadges = [mkGLabel(), mkGLabel(), mkGLabel(), mkGLabel()];

  const tip = document.createElement("div");
  tip.className = "lpe-pk-tip";
  shadow.appendChild(tip);

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
    // Don't hijack right-clicks on our chip either.
    if (e.composedPath().includes(chip)) return;
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
    // Let chip-button clicks through to their own handlers.
    if (e.composedPath().includes(chip)) return;
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

  // P1: short-circuit overlay re-targeting while pointer is on the chip
  const onChipEnter = (): void => { if (state) state.chipHover = true; };
  const onChipLeave = (): void => { if (state) state.chipHover = false; };
  chip.addEventListener("pointerenter", onChipEnter);
  chip.addEventListener("pointerleave", onChipLeave);

  // P2: chip button handlers — operate on the last highlighted target.
  const fireSelect = (e: Event): void => {
    e.preventDefault(); e.stopPropagation();
    const t = state?.currentTarget ?? null;
    if (!t) return;
    const rect = t.getBoundingClientRect();
    void Promise.resolve(handlers.onSelect({ element: t, rect })).catch((err) => {
      logger.warn(LogCategory.Picker, "SELECT_FAIL", "select handler threw", err);
    });
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
  chipBtnSelect.addEventListener("click", fireSelect);
  chipBtnCopy.addEventListener("click", (e) => { void fireCopy(e); });
  chipBtnCancel.addEventListener("click", fireCancel);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      handlers.onCancel();
      exitPicker();
      return;
    }
    if ((e.key === "Alt" || e.altKey) && state && !state.altDown) {
      state.altDown = true;
      updateOverlay(state.lastX, state.lastY);
    }
    if (!state) return;
    const navKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
    if (!navKeys.includes(e.key)) return;
    const t = e.target as Element | null;
    if (t?.closest?.("#inspect-page-panel-host")) return;
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
    showTarget(next);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "Alt" && state && state.altDown) {
      state.altDown = false;
      updateOverlay(state.lastX, state.lastY);
    }
  };

  window.addEventListener("mousemove", onMoveThrottled, true);
  window.addEventListener("mouseover", onMoveThrottled, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);

  const cleanup = (): void => {
    window.removeEventListener("mousemove", onMoveThrottled, true);
    window.removeEventListener("mouseover", onMoveThrottled, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    chip.removeEventListener("pointerenter", onChipEnter);
    chip.removeEventListener("pointerleave", onChipLeave);
  };

  state = {
    host, shadow, box, marginBox, paddingBox, size,
    chip, chipBtnSelect, chipBtnCopy, chipBtnCancel, chipFlash,
    chipHover: false, currentTarget: null,
    badges, mBadges, tip,
    guides, gBadges, altDown: false, lastX: -1, lastY: -1, navTarget: null,
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
  state.lastX = x; state.lastY = y;
  const target = state.navTarget ?? pickTarget(x, y);
  if (!target) {
    hideAll();
    return;
  }
  const r = target.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    hideAll();
    return;
  }
  state.currentTarget = target;
  state.box.style.left = `${r.left}px`;
  state.box.style.top = `${r.top}px`;
  state.box.style.width = `${r.width}px`;
  state.box.style.height = `${r.height}px`;
  state.box.style.display = "block";

  // Box-model rulers (margin + padding)
  let cs: CSSStyleDeclaration | null = null;
  try { cs = getComputedStyle(target); } catch { cs = null; }
  const num = (v: string | undefined): number => {
    const n = parseFloat(v ?? "0");
    return Number.isFinite(n) ? n : 0;
  };
  const mt = num(cs?.marginTop), mr = num(cs?.marginRight),
        mb = num(cs?.marginBottom), ml = num(cs?.marginLeft);
  const pt = num(cs?.paddingTop), pr = num(cs?.paddingRight),
        pb = num(cs?.paddingBottom), pl = num(cs?.paddingLeft);

  if (mt || mr || mb || ml) {
    state.marginBox.style.left = `${r.left - ml}px`;
    state.marginBox.style.top = `${r.top - mt}px`;
    state.marginBox.style.width = `${r.width + ml + mr}px`;
    state.marginBox.style.height = `${r.height + mt + mb}px`;
    state.marginBox.style.display = "block";
  } else {
    state.marginBox.style.display = "none";
  }

  if (pt || pr || pb || pl) {
    state.paddingBox.style.left = `${r.left + pl}px`;
    state.paddingBox.style.top = `${r.top + pt}px`;
    state.paddingBox.style.width = `${Math.max(0, r.width - pl - pr)}px`;
    state.paddingBox.style.height = `${Math.max(0, r.height - pt - pb)}px`;
    state.paddingBox.style.display = "block";
  } else {
    state.paddingBox.style.display = "none";
  }

  positionBadge(state.badges[0]!, pt, r.left + r.width / 2, r.top + 2, "cx");
  positionBadge(state.badges[1]!, pr, r.right - 2, r.top + r.height / 2, "rx");
  positionBadge(state.badges[2]!, pb, r.left + r.width / 2, r.bottom - 2, "cx");
  positionBadge(state.badges[3]!, pl, r.left + 2, r.top + r.height / 2, "lx");

  positionBadge(state.mBadges[0]!, mt, r.left + r.width / 2, r.top - mt / 2, "cx");
  positionBadge(state.mBadges[1]!, mr, r.right + mr / 2, r.top + r.height / 2, "cx");
  positionBadge(state.mBadges[2]!, mb, r.left + r.width / 2, r.bottom + mb / 2, "cx");
  positionBadge(state.mBadges[3]!, ml, r.left - ml / 2, r.top + r.height / 2, "cx");

  // Chip — size badge + action icons, anchored bottom-right of element with
  // viewport-edge collision flips so it never overlaps the highlighted box.
  state.size.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
  state.chip.style.display = "inline-flex";
  // Measure first to flip cleanly
  const cw = state.chip.offsetWidth || 120;
  const ch = state.chip.offsetHeight || 28;
  let chipLeft = Math.min(window.innerWidth - cw - 4, Math.max(4, r.right - cw));
  let chipTop = r.bottom + 6;
  if (chipTop + ch > window.innerHeight) chipTop = Math.max(4, r.top - ch - 6);
  // Avoid covering the element if it's tall and chip would land inside it.
  if (chipTop > r.top && chipTop < r.bottom) chipTop = r.bottom + 6;
  state.chip.style.left = `${chipLeft}px`;
  state.chip.style.top = `${chipTop}px`;

  // Tooltip — tag + id + classes (rich markup)
  state.tip.innerHTML = buildDetailHtml(target);
  state.tip.style.display = "block";
  // Position: prefer cursor + (12,12), flip if overflows.
  const tipRect = state.tip.getBoundingClientRect();
  let tx = x + 12;
  let ty = y + 12;
  if (tx + tipRect.width > window.innerWidth) tx = x - 12 - tipRect.width;
  if (ty + tipRect.height > window.innerHeight) ty = y - 12 - tipRect.height;
  state.tip.style.left = `${Math.max(0, tx)}px`;
  state.tip.style.top = `${Math.max(0, ty)}px`;

  // ---- B3: distance guides (Alt held) — distance to viewport edges ----
  if (state.altDown) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // top guide: vertical line from element top to y=0
    setGuide(state.guides[0]!, "v", cx, 0, r.top, "v");
    setGLabel(state.gBadges[0]!, Math.round(r.top), cx + 6, r.top / 2);
    // right guide: horizontal line from r.right to vw
    setGuide(state.guides[1]!, "h", r.right, cy, vw - r.right, "h");
    setGLabel(state.gBadges[1]!, Math.round(vw - r.right), (r.right + vw) / 2, cy - 14);
    // bottom guide: vertical line from r.bottom to vh
    setGuide(state.guides[2]!, "v", cx, r.bottom, vh - r.bottom, "v");
    setGLabel(state.gBadges[2]!, Math.round(vh - r.bottom), cx + 6, (r.bottom + vh) / 2);
    // left guide: horizontal line from x=0 to r.left
    setGuide(state.guides[3]!, "h", 0, cy, r.left, "h");
    setGLabel(state.gBadges[3]!, Math.round(r.left), r.left / 2, cy - 14);
  } else {
    for (const g of state.guides) g.style.display = "none";
    for (const b of state.gBadges) b.style.display = "none";
  }
}

function hideAll(): void {
  if (!state) return;
  state.box.style.display = "none";
  state.tip.style.display = "none";
  state.marginBox.style.display = "none";
  state.paddingBox.style.display = "none";
  state.chip.style.display = "none";
  state.currentTarget = null;
  for (const b of state.badges) b.style.display = "none";
  for (const b of state.mBadges) b.style.display = "none";
  for (const g of state.guides) g.style.display = "none";
  for (const b of state.gBadges) b.style.display = "none";
}

function setGuide(
  el: HTMLDivElement,
  orient: "h" | "v",
  x: number,
  y: number,
  length: number,
  _kind: "h" | "v",
): void {
  if (length < 1) { el.style.display = "none"; return; }
  el.style.display = "block";
  if (orient === "v") {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.height = `${Math.round(length)}px`;
    el.style.width = "1px";
  } else {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${Math.round(length)}px`;
    el.style.height = "1px";
  }
}

function setGLabel(el: HTMLDivElement, value: number, cx: number, cy: number): void {
  if (value < 1) { el.style.display = "none"; return; }
  el.textContent = `${value}px`;
  el.style.display = "block";
  const rect = el.getBoundingClientRect();
  el.style.left = `${Math.max(0, Math.round(cx - rect.width / 2))}px`;
  el.style.top = `${Math.max(0, Math.round(cy - rect.height / 2))}px`;
}

/** B4: re-render overlay anchored on a keyboard-selected element. */
function showTarget(el: Element): void {
  if (!state) return;
  const r = el.getBoundingClientRect();
  // Anchor cursor coordinates near the element so the tooltip lands sensibly.
  updateOverlay(r.left + Math.min(40, r.width / 2), r.top + Math.min(20, r.height / 2));
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

function positionBadge(el: HTMLDivElement, value: number, cx: number, cy: number, _anchor: string): void {
  if (!value || value < 1) { el.style.display = "none"; return; }
  el.textContent = `${Math.round(value)}px`;
  el.style.display = "block";
  // measure + center
  const rect = el.getBoundingClientRect();
  el.style.left = `${Math.max(0, cx - rect.width / 2)}px`;
  el.style.top = `${Math.max(0, cy - rect.height / 2)}px`;
}

function describeRich(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${escapeHtml(el.id)}` : "";
  const cls = Array.from(el.classList).slice(0, 3).map((c) => `.${escapeHtml(c)}`).join("");
  const role = (el as HTMLElement).getAttribute?.("role");
  const roleHtml = role ? `<i>${escapeHtml(role)}</i>` : "";
  const text = `<b>${tag}</b>${id}${cls}`.slice(0, PICKER_TOOLTIP_MAX_CHARS + 32);
  return `${text}${roleHtml}`;
}

function rgbToHex(value: string): string {
  const v = (value || "").trim();
  if (!v || v === "transparent" || v === "rgba(0, 0, 0, 0)") return "transparent";
  if (v.startsWith("#")) return v.length === 4
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase()
    : v.toUpperCase();
  const m = /rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?:\s*[,/ ]\s*([\d.]+))?\s*\)/i.exec(v);
  if (!m) return v;
  const r = (+m[1]!).toString(16).padStart(2, "0");
  const g = (+m[2]!).toString(16).padStart(2, "0");
  const b = (+m[3]!).toString(16).padStart(2, "0");
  const aRaw = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 255) : 255;
  if (aRaw === 0) return "transparent";
  const a = aRaw < 255 ? aRaw.toString(16).padStart(2, "0") : "";
  return `#${r}${g}${b}${a}`.toUpperCase();
}

function resolveBgHex(el: Element): string {
  let cur: Element | null = el;
  while (cur) {
    let cs: CSSStyleDeclaration | null = null;
    try { cs = getComputedStyle(cur); } catch { cs = null; }
    const hex = rgbToHex(cs?.backgroundColor ?? "");
    if (hex !== "transparent") {
      // collapse alpha for contrast math
      return hex.length === 9 ? hex.slice(0, 7) : hex;
    }
    cur = cur.parentElement;
  }
  return "#FFFFFF";
}

function shortFontFamily(stack: string): string {
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
  return first || stack;
}

function buildDetailHtml(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${escapeHtml(el.id)}` : "";
  const cls = Array.from(el.classList).slice(0, 2).map((c) => `.${escapeHtml(c)}`).join("");
  const head = `${tag}${id}${cls}`.slice(0, PICKER_TOOLTIP_MAX_CHARS + 32);
  const r = el.getBoundingClientRect();
  const sub = `${Math.round(r.width)} × ${Math.round(r.height)}`;

  let cs: CSSStyleDeclaration | null = null;
  try { cs = getComputedStyle(el); } catch { cs = null; }

  const fgHex = rgbToHex(cs?.color ?? "");
  const bgRawHex = rgbToHex(cs?.backgroundColor ?? "");
  const bgHex = bgRawHex === "transparent" ? resolveBgHex(el) : (bgRawHex.length === 9 ? bgRawHex.slice(0, 7) : bgRawHex);
  const fontFamily = shortFontFamily(cs?.fontFamily ?? "");
  const fontSize = cs?.fontSize ?? "";
  const lineHeightRaw = cs?.lineHeight ?? "";
  const lineHeight = lineHeightRaw === "normal" ? "normal" : lineHeightRaw;
  const fontWeight = cs?.fontWeight ?? "";
  const padding = cs ? `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}` : "";

  const fSize = parseFloat(fontSize) || 0;
  const fWeight = parseInt(fontWeight, 10) || 400;
  const fgForRatio = fgHex === "transparent" ? "#000000" : (fgHex.length === 9 ? fgHex.slice(0, 7) : fgHex);
  const ratio = contrastRatio(fgForRatio, bgHex);
  const v = verdict(ratio);
  const large = isLargeText(fSize, fWeight);
  const passes = large ? v.largeAA : v.normalAA;
  const pillClass = v.label === "Excellent" ? "ok" : v.label === "Good" ? "ok" : v.label === "Poor" ? "warn" : "bad";

  const swatch = (hex: string): string => {
    if (hex === "transparent") return `<span class="lpe-pk-sw" title="transparent"></span>`;
    const css = hex.length === 9 ? `#${hex.slice(1, 7)}` : hex;
    return `<span class="lpe-pk-sw lpe-pk-sw-fill" style="background:${css}"></span>`;
  };

  const row = (k: string, v: string): string =>
    `<div class="lpe-pk-k">${escapeHtml(k)}</div><div class="lpe-pk-v">${v}</div>`;

  const rows = [
    row("Text color", `${swatch(fgHex)}${escapeHtml(fgHex)}`),
    row("Background", `${swatch(bgHex)}${escapeHtml(bgHex)}`),
    row("Font family", escapeHtml(fontFamily)),
    row("Font size", escapeHtml(fontSize)),
    row("Line height", escapeHtml(String(lineHeight))),
    row("Font weight", escapeHtml(fontWeight)),
    row("Padding", escapeHtml(padding)),
    row("Contrast",
      `<span>${ratio.toFixed(2)}</span><span class="lpe-pk-pill ${pillClass}" title="${large ? "Large text" : "Normal text"} · ${passes ? "Passes" : "Fails"} WCAG AA">${escapeHtml(v.label)}</span>`),
  ].join("");

  return `<div class="lpe-pk-head">${escapeHtml(head)}</div><div class="lpe-pk-sub">${escapeHtml(sub)}</div><div class="lpe-pk-rows">${rows}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;"
  ));
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
