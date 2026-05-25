/**
 * Phase A4b — Text Typography section (CSS Peeper style).
 *
 * Renders one card per (tag + family + size + weight + color) group from
 * `snapshot.typography`. Each card shows the tag label, instance count,
 * an `AaBbCc…` sample rendered in the element's actual typographic
 * style, a Locate button (flashes matches in the live DOM), and a
 * "Show details" link that opens a drawer with the full breakdown.
 */
import { useState } from "react";
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { InspectSnapshot, TypographyGroup } from "../../inspect/types";

const SAMPLE = "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz";
const COLLAPSED_COUNT = 2;

/**
 * Resolve any CSS color string (hex, rgb, hsl, lab, named, …) to its sRGB
 * components by letting the browser parse it via a throwaway canvas. Returns
 * null when the color cannot be parsed.
 */
function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#000";
    ctx.fillStyle = color; // browser normalizes; invalid → stays "#000"
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  } catch { return null; }
}

function relativeLuminance(r: number, g: number, b: number): number {
  const f = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Pick a background that contrasts with the given text color so the sample
 * is always readable. Light text → dark bg, dark text → light bg.
 */
function contrastingBg(color: string): string {
  const rgb = parseColorToRgb(color);
  if (!rgb) return "#1a2420";
  // Soft theme-friendly surfaces — avoid stark pure white/black that clashes
  // with the dark-mint panel chrome.
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.5 ? "#1a2420" : "#eef2ef";
}

export interface InspectTextTypographyProps { snapshot: InspectSnapshot }

export function InspectTextTypography({ snapshot }: InspectTextTypographyProps): JSX.Element | null {
  const [open, setOpen] = useState<TypographyGroup | null>(null);
  const [showAll, setShowAll] = useState(false);
  const groups = snapshot.typography ?? [];
  if (groups.length === 0) return null;
  const visible = showAll ? groups : groups.slice(0, COLLAPSED_COUNT);
  const hidden = groups.length - COLLAPSED_COUNT;

  return (
    <section className="lpe-typo lpe-text-typo" aria-label="Text Typography">
      <header className="lpe-section-header lpe-text-typo-header">
        <h2 className="lpe-section-title">Text Typography</h2>
        {groups.length > COLLAPSED_COUNT && (
          <button
            type="button"
            className="lpe-link lpe-text-typo-toggle"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Show less" : `See more (${hidden} more)`}
          </button>
        )}
      </header>

      <div className="lpe-text-typo-list">
        {visible.map((g, i) => (
          <TextTypoCard key={`${g.tag}-${i}`} group={g} onShowDetails={() => setOpen(g)} />
        ))}
      </div>

      {open && <TextTypoDetailDrawer group={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function TextTypoCard({ group, onShowDetails }: {
  group: TypographyGroup; onShowDetails: () => void;
}): JSX.Element {
  const onLocate = async (): Promise<void> => {
    try {
      await sendToBackground<{ tabId: number; selector: string }, { count: number }>(
        MessageKind.LocateElement, { tabId: -1, selector: group.selectorPath },
      );
    } catch { /* never break the panel */ }
  };

  const sample = group.sampleText && group.sampleText.length > 0 ? group.sampleText : SAMPLE;
  const bg = contrastingBg(group.color || "#111111");

  return (
    <div className="lpe-text-typo-card">
      <div className="lpe-text-typo-head">
        <div className="lpe-text-typo-titles">
          <span className="lpe-text-typo-tag">{group.label}</span>
          <span className="lpe-text-typo-meta">
            {group.instances} {group.instances === 1 ? "instance" : "instances"}
          </span>
        </div>
        <button
          type="button" className="lpe-text-typo-locate"
          onClick={() => void onLocate()}
          title={`Locate on page (${group.selectorPath})`}
          aria-label="Locate on page"
        >⊕</button>
      </div>
      <div
        className="lpe-text-typo-sample"
        style={{
          fontFamily: group.fontStack || group.fontFamily,
          fontSize: `${Math.max(11, Math.min(group.fontSizePx, 15))}px`,
          fontWeight: group.fontWeight,
          color: group.color || "var(--lpe-fg)",
          background: bg,
          lineHeight: 1.35,
          letterSpacing: group.letterSpacing !== "normal" ? group.letterSpacing : undefined,
        }}
        title={sample}
      >{sample}</div>
      {group.color && (
        <span className="lpe-text-typo-color-chip">
          <span className="swatch" style={{ background: group.color }} />
          {group.color}
        </span>
      )}
      <button type="button" className="lpe-link lpe-text-typo-details" onClick={onShowDetails}>
        Show details ›
      </button>
    </div>
  );
}

function TextTypoDetailDrawer({ group, onClose }: {
  group: TypographyGroup; onClose: () => void;
}): JSX.Element {
  const copy = (v: string): void => { try { void navigator.clipboard.writeText(v); } catch { /* ignore */ } };
  return (
    <div className="lpe-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${group.label} typography details`} onClick={onClose}>
      <div className="lpe-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lpe-modal-header">
          <h3>{group.label} · typography</h3>
          <button type="button" className="lpe-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="lpe-modal-body">
          <div
            className="lpe-text-typo-preview"
            style={{
              fontFamily: group.fontStack || group.fontFamily,
              fontSize: `${Math.max(14, Math.min(group.fontSizePx, 28))}px`,
              fontWeight: group.fontWeight,
              color: group.color || "#111111",
              background: contrastingBg(group.color || "#111111"),
              lineHeight: group.lineHeightPx ? `${group.lineHeightPx}px` : undefined,
              letterSpacing: group.letterSpacing !== "normal" ? group.letterSpacing : undefined,
            }}
          >{group.sampleText || SAMPLE}</div>

          <dl className="lpe-detail-grid">
            <DRow label="Tag" value={`<${group.tag}>`} />
            <DRow label="Instances" value={String(group.instances)} />
            <DRow label="Font family" value={group.fontFamily} onCopy={() => copy(group.fontFamily)} />
            <DRow label="Font stack" value={group.fontStack} onCopy={() => copy(group.fontStack)} />
            <DRow label="Size" value={`${group.fontSizePx}px`} />
            <DRow label="Weight" value={String(group.fontWeight)} />
            <DRow label="Line height" value={group.lineHeightPx == null ? "normal" : `${group.lineHeightPx}px`} />
            <DRow label="Letter spacing" value={group.letterSpacing || "normal"} />
            <DRow label="Color" value={group.color} swatch={group.color} onCopy={() => copy(group.color)} />
            <DRow label="Selector" value={group.selectorPath} onCopy={() => copy(group.selectorPath)} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function DRow({ label, value, swatch, onCopy }: {
  label: string; value: string; swatch?: string; onCopy?: () => void;
}): JSX.Element {
  return (
    <div className="lpe-detail-row">
      <dt>{label}</dt>
      <dd className="lpe-detail-value" title={value}>
        {swatch && <span className="lpe-eli-swatch" style={{ background: swatch }} aria-hidden="true" />}
        {value}
      </dd>
      {onCopy && (
        <button type="button" className="lpe-link" onClick={onCopy} aria-label={`Copy ${label}`}>Copy</button>
      )}
    </div>
  );
}