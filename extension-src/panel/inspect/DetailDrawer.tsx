/**
 * Phase A10 — Detail drawer.
 *
 * Generic detail modal opened by clicking a token (currently colors).
 * Shows hex/rgb/hsl + alpha, category, instance count, with one-click
 * copy buttons for each format. Reuses `lpe-modal-*`.
 */
import { useEffect, useState, useCallback } from "react";
import { COPY } from "@shared/copy";
import type { ColorUsage } from "../../inspect/types";
import { parseHex, rgbToHsl, formatRgb, formatHsl, type RgbColor, type HslColor } from "../../inspect/colorMath";

export interface DetailDrawerProps {
  color: ColorUsage;
  onClose(): void;
}

export function DetailDrawer({ color, onClose }: DetailDrawerProps): JSX.Element {
  const [copied, setCopied] = useState<string | null>(null);
  const rgb = parseHex(color.value);
  const hsl: HslColor | null = rgb ? rgbToHsl(rgb) : null;
  const rgbStr = rgb ? formatRgb(rgb) : color.value;
  const hslStr = hsl ? formatHsl(hsl) : color.value;

  const copy = useCallback(async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(label);
    window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1200);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lpe-modal-backdrop" role="dialog" aria-modal="true" aria-label={COPY.inspectDetailTitle} onClick={onClose}>
      <div className="lpe-modal lpe-modal-detail" onClick={(e) => e.stopPropagation()}>
        <div className="lpe-modal-header">
          <h3>{COPY.inspectDetailTitle}</h3>
          <button type="button" className="lpe-btn" onClick={onClose} aria-label={COPY.inspectClose}>{COPY.inspectClose}</button>
        </div>
        <div className="lpe-modal-body lpe-detail-body">
          <div
            className={`lpe-detail-swatch ${color.transparent ? "is-transparent" : ""}`}
            style={color.transparent ? undefined : { background: color.value }}
            aria-hidden="true"
          />
          <dl className="lpe-detail-grid">
            <Row label={COPY.inspectDetailHex} value={color.value}
              copyLabel={COPY.inspectDetailCopyHex}
              copied={copied === "hex"}
              onCopy={() => void copy("hex", color.value)} />
            <Row label={COPY.inspectDetailRgb} value={rgbStr}
              copyLabel={COPY.inspectDetailCopyRgb}
              copied={copied === "rgb"}
              onCopy={() => void copy("rgb", rgbStr)} />
            <Row label={COPY.inspectDetailHsl} value={hslStr}
              copyLabel={COPY.inspectDetailCopyHsl}
              copied={copied === "hsl"}
              onCopy={() => void copy("hsl", hslStr)} />
            {rgb && rgb.a < 0.999 && (
              <RowStatic label={COPY.inspectDetailAlpha} value={Number(rgb.a.toFixed(3)).toString()} />
            )}
            <RowStatic label={COPY.inspectDetailCategory} value={color.category} />
            <RowStatic label={COPY.inspectDetailInstances} value={`${color.instances}×`} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, copyLabel, copied, onCopy }: {
  label: string; value: string; copyLabel: string; copied: boolean; onCopy(): void;
}): JSX.Element {
  return (
    <div className="lpe-detail-row">
      <dt>{label}</dt>
      <dd className="lpe-detail-value" title={value}>{value}</dd>
      <button type="button" className="lpe-link" onClick={onCopy}>
        {copied ? COPY.inspectDetailCopied : copyLabel}
      </button>
    </div>
  );
}

function RowStatic({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="lpe-detail-row lpe-detail-row-static">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// Type re-exports kept implicit; consumers import from this module if needed.
export type { RgbColor };