/**
 * Element-picker DOM construction — extracted from picker.ts per B1.
 *
 * Builds the full Shadow-DOM tree (overlay boxes, chip, badges, guides,
 * tooltip, multi-pick bar, toast) and returns every created element so
 * picker.ts can wire listeners and drive updates.
 */
import { Z_INDEX_PICKER } from "@shared/constants";
import { PICKER_STYLE as STYLE, PICKER_SEL_STYLE as SEL_STYLE } from "./picker-styles";

export interface PickerDomElements {
  host: HTMLDivElement;
  shadow: ShadowRoot;
  box: HTMLDivElement;
  marginBox: HTMLDivElement;
  paddingBox: HTMLDivElement;
  size: HTMLDivElement;
  chip: HTMLDivElement;
  chipBtnSelect: HTMLButtonElement;
  chipBtnCopy: HTMLButtonElement;
  chipBtnCancel: HTMLButtonElement;
  chipFlash: HTMLSpanElement;
  badges: HTMLDivElement[];
  mBadges: HTMLDivElement[];
  guides: HTMLDivElement[];
  gBadges: HTMLDivElement[];
  tip: HTMLDivElement;
  selLayer: HTMLDivElement;
  bar: HTMLDivElement;
  barDone: HTMLButtonElement;
  barCancel: HTMLButtonElement;
  barCount: HTMLSpanElement;
  toast: HTMLDivElement;
}

const HOST_ID = "inspect-page-picker-host";

export function buildPickerDom(): PickerDomElements {
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
  barCount.textContent = "0 / 11";
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

  return {
    host, shadow, box, marginBox, paddingBox, size,
    chip, chipBtnSelect, chipBtnCopy, chipBtnCancel, chipFlash,
    badges, mBadges, guides, gBadges, tip,
    selLayer, bar, barDone, barCancel, barCount, toast,
  };
}
