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
  marginBox: HTMLDivElement;
  paddingBox: HTMLDivElement;
  size: HTMLDivElement;
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
  position: fixed; pointer-events: none;
  z-index: ${Z_INDEX_PICKER};
  display: none;
  background: #7c5cff; color: #ffffff;
  font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 2px 5px; border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.35);
  white-space: nowrap;
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
  padding: 4px 8px; border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.32);
  border: 1px solid rgba(255,255,255,0.08);
  z-index: ${Z_INDEX_PICKER};
  white-space: nowrap; max-width: 80vw; overflow: hidden;
  display: none;
}
.lpe-pk-tip b { color: #c4b5fd; font-weight: 600; }
.lpe-pk-tip i { color: #9ca3af; font-style: normal; margin-left: 6px; }
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
  shadow.appendChild(size);

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
  };

  state = {
    host, shadow, box, marginBox, paddingBox, size, badges, mBadges, tip,
    guides, gBadges, altDown: false, lastX: -1, lastY: -1,
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
  const target = pickTarget(x, y);
  if (!target) {
    hideAll();
    return;
  }
  const r = target.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    hideAll();
    return;
  }
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

  // Size chip — bottom-right of the element
  state.size.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
  state.size.style.left = `${Math.max(0, r.right - 60)}px`;
  state.size.style.top = `${Math.min(window.innerHeight - 18, r.bottom + 4)}px`;
  state.size.style.display = "block";

  // Tooltip — tag + id + classes (rich markup)
  state.tip.innerHTML = describeRich(target);
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
  state.size.style.display = "none";
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
