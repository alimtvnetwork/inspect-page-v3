/**
 * Element-picker overlay rendering — extracted from picker.ts per B1.
 *
 * All visual-update functions that read PickerState and mutate DOM styles.
 * updateOverlay, hideAll, distance guides, and helper positioning.
 */
import type { PickerState } from "./picker";
import { buildDetailHtml } from "./tooltip-detail";

export function updateOverlay(
  state: PickerState,
  x: number,
  y: number,
  target: Element | null,
): void {
  state.lastX = x;
  state.lastY = y;
  if (!target) {
    hideAll(state);
    return;
  }
  const r = target.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    hideAll(state);
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
  const chipLeft = Math.min(window.innerWidth - cw - 4, Math.max(4, r.right - cw));
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

export function hideAll(state: PickerState): void {
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
export function showTarget(state: PickerState, el: Element): void {
  const r = el.getBoundingClientRect();
  // Anchor cursor coordinates near the element so the tooltip lands sensibly.
  updateOverlay(
    state,
    r.left + Math.min(40, r.width / 2),
    r.top + Math.min(20, r.height / 2),
    el,
  );
}

export function positionBadge(
  el: HTMLDivElement,
  value: number,
  cx: number,
  cy: number,
  _anchor: string,
): void {
  if (!value || value < 1) { el.style.display = "none"; return; }
  el.textContent = `${Math.round(value)}px`;
  el.style.display = "block";
  // measure + center
  const rect = el.getBoundingClientRect();
  el.style.left = `${Math.max(0, cx - rect.width / 2)}px`;
  el.style.top = `${Math.max(0, cy - rect.height / 2)}px`;
}
