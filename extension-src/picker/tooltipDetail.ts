/**
 * Tooltip detail HTML for the element picker — color/contrast/typography
 * rows shown next to the hovered element. Split out of picker.ts per R7.
 */
import { PICKER_TOOLTIP_MAX_CHARS } from "@shared/constants";
import { contrastRatio, isLargeText, verdict } from "../inspect/contrast";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === '"' ? "&quot;" : "&#39;"
  ));
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

function swatch(hex: string): string {
  if (hex === "transparent") return `<span class="lpe-pk-sw" title="transparent"></span>`;
  const css = hex.length === 9 ? `#${hex.slice(1, 7)}` : hex;
  return `<span class="lpe-pk-sw lpe-pk-sw-fill" style="background:${css}"></span>`;
}

function row(k: string, v: string): string {
  return `<div class="lpe-pk-k">${escapeHtml(k)}</div><div class="lpe-pk-v">${v}</div>`;
}

interface TypographyDetails {
  fgHex: string;
  bgHex: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  padding: string;
}

function readTypography(el: Element): TypographyDetails {
  let cs: CSSStyleDeclaration | null = null;
  try { cs = getComputedStyle(el); } catch { cs = null; }
  const fgHex = rgbToHex(cs?.color ?? "");
  const bgRawHex = rgbToHex(cs?.backgroundColor ?? "");
  const bgHex = bgRawHex === "transparent" ? resolveBgHex(el) : (bgRawHex.length === 9 ? bgRawHex.slice(0, 7) : bgRawHex);
  const lineHeightRaw = cs?.lineHeight ?? "";
  return {
    fgHex,
    bgHex,
    fontFamily: shortFontFamily(cs?.fontFamily ?? ""),
    fontSize: cs?.fontSize ?? "",
    lineHeight: lineHeightRaw === "normal" ? "normal" : lineHeightRaw,
    fontWeight: cs?.fontWeight ?? "",
    padding: cs ? `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}` : "",
  };
}

function contrastRow(t: TypographyDetails): string {
  const fSize = parseFloat(t.fontSize) || 0;
  const fWeight = parseInt(t.fontWeight, 10) || 400;
  const fgForRatio = t.fgHex === "transparent" ? "#000000" : (t.fgHex.length === 9 ? t.fgHex.slice(0, 7) : t.fgHex);
  const ratio = contrastRatio(fgForRatio, t.bgHex);
  const v = verdict(ratio);
  const large = isLargeText(fSize, fWeight);
  const passes = large ? v.largeAA : v.normalAA;
  const pillClass = v.label === "Excellent" || v.label === "Good" ? "ok" : v.label === "Poor" ? "warn" : "bad";
  return row(
    "Contrast",
    `<span>${ratio.toFixed(2)}</span><span class="lpe-pk-pill ${pillClass}" title="${large ? "Large text" : "Normal text"} · ${passes ? "Passes" : "Fails"} WCAG AA">${escapeHtml(v.label)}</span>`,
  );
}

export function buildDetailHtml(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${escapeHtml(el.id)}` : "";
  const cls = Array.from(el.classList).slice(0, 2).map((c) => `.${escapeHtml(c)}`).join("");
  const head = `${tag}${id}${cls}`.slice(0, PICKER_TOOLTIP_MAX_CHARS + 32);
  const r = el.getBoundingClientRect();
  const sub = `${Math.round(r.width)} × ${Math.round(r.height)}`;
  const t = readTypography(el);
  const rows = [
    row("Text color", `${swatch(t.fgHex)}${escapeHtml(t.fgHex)}`),
    row("Background", `${swatch(t.bgHex)}${escapeHtml(t.bgHex)}`),
    row("Font family", escapeHtml(t.fontFamily)),
    row("Font size", escapeHtml(t.fontSize)),
    row("Line height", escapeHtml(String(t.lineHeight))),
    row("Font weight", escapeHtml(t.fontWeight)),
    row("Padding", escapeHtml(t.padding)),
    contrastRow(t),
  ].join("");
  return `<div class="lpe-pk-head">${escapeHtml(head)}</div><div class="lpe-pk-sub">${escapeHtml(sub)}</div><div class="lpe-pk-rows">${rows}</div>`;
}
