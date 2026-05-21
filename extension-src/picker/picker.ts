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
import { PICKER_STYLE as STYLE, PICKER_SEL_STYLE as SEL_STYLE } from "./pickerStyles";
import { buildDetailHtml } from "./tooltipDetail";

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
  styleEl.textContent = STYLE + SEL_STYLE;
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
  const chipBtnSelect = mkChipBtn("Add to selection", "✓", "select");
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

  // Phase 1 multi-pick — persistent selection layer + top bar + toast
  const selLayer = document.createElement("div");
  selLayer.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  shadow.appendChild(selLayer);

  const bar = document.createElement("div");
  bar.className = "lpe-pk-bar";
  const barDone = document.createElement("button");
  barDone.type = "button";
  barDone.className = "lpe-pk-bar-btn";
  barDone.dataset.variant = "done";
  barDone.textContent = "Done";
  barDone.disabled = true;
  const barCount = document.createElement("span");
  barCount.className = "lpe-pk-bar-count";
  barCount.textContent = `0 / ${MAX_PICKS}`;
  const barCancel = document.createElement("button");
  barCancel.type = "button";
  barCancel.className = "lpe-pk-bar-btn";
  barCancel.dataset.variant = "cancel";
  barCancel.textContent = "Cancel";
  bar.append(barDone, barCount, barCancel);
  shadow.appendChild(bar);

  const toast = document.createElement("div");
  toast.className = "lpe-pk-toast";
  shadow.appendChild(toast);

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
    // Let bar-button clicks through to their own handlers.
    if (e.composedPath().includes(bar)) return;
    e.preventDefault(); e.stopPropagation();
    const target = pickTarget(e.clientX, e.clientY);
    if (!target) return;
    // Phase 1: toggle into multi-pick selections; commit happens on Done.
    toggleSelection(target);
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
  barDone.addEventListener("click", fireDone);
  barCancel.addEventListener("click", fireBarCancel);

  const cleanup = (): void => {
    window.removeEventListener("mousemove", onMoveThrottled, true);
    window.removeEventListener("mouseover", onMoveThrottled, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize, true);
    chip.removeEventListener("pointerenter", onChipEnter);
    chip.removeEventListener("pointerleave", onChipLeave);
    barDone.removeEventListener("click", fireDone);
    barCancel.removeEventListener("click", fireBarCancel);
    if (state?.toastTimer) window.clearTimeout(state.toastTimer);
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
    selections: [], selLayer, bar, barDone, barCancel, barCount,
    toast, toastTimer: null, onScrollOrResize,
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
