/**
 * C3 — Rich Pick Element inspector view.
 *
 * Renders identity, box-model diagram, and text properties for the picked
 * element. C4 layers Selection colors + Contrast on top; C5 adds the Code
 * preview drawer; C6 docks the four export-mode buttons in the footer.
 *
 * Pure presentational — receives an already-collected `ElementSnapshot`.
 */
import { useCallback, useState } from "react";
import type { ElementSnapshot } from "@element/collectElementSnapshot";

export interface ElementInspectorProps {
  snapshot: ElementSnapshot;
  /** "Show code" toggle handler — owned by parent (drawer lands in C5). */
  onShowCode?: () => void;
  /** Back arrow — clears the snapshot and returns to the picker landing. */
  onBack?: () => void;
  /** "Context menu while hovering" toggle (re-arms the picker). */
  onTogglePickerLock?: (next: boolean) => void;
  pickerLocked?: boolean;
}

export function ElementInspector(props: ElementInspectorProps): JSX.Element {
  const { snapshot, onShowCode, onBack, onTogglePickerLock, pickerLocked } = props;
  const { identity, box, text } = snapshot;

  const copy = useCallback(async (v: string) => {
    try { await navigator.clipboard.writeText(v); } catch { /* ignore */ }
  }, []);

  return (
    <div className="lpe-eli" aria-label="Element inspector">
      <div className="lpe-eli-header">
        {onBack && (
          <button type="button" className="lpe-header-btn" onClick={onBack} aria-label="Back">←</button>
        )}
        <span className="lpe-eli-title">Inspector</span>
        <span className="lpe-spacer" />
        <button
          type="button"
          className="lpe-btn lpe-eli-show-code"
          onClick={onShowCode}
          aria-label="Show code"
        >Show code</button>
      </div>

      <div className="lpe-eli-identity">
        <div className="lpe-eli-label">{identity.label}</div>
        <div className="lpe-eli-selector" title={identity.selectorPath}>
          <span className="lpe-eli-tag">{identity.tag}</span>
          {identity.classList.slice(0, 3).map((c) => (
            <span key={c} className="lpe-eli-class">.{c}</span>
          ))}
        </div>
      </div>

      <label className="lpe-eli-toggle">
        <input
          type="checkbox"
          checked={!!pickerLocked}
          onChange={(e) => onTogglePickerLock?.(e.target.checked)}
        />
        <span>Context menu while hovering</span>
      </label>

      <BoxModel snapshot={snapshot} />

      <section className="lpe-eli-section" aria-label="Text properties">
        <h4 className="lpe-eli-h4">Text properties</h4>
        <Row label="Font Family" value={text.fontFamily} mono onCopy={() => copy(text.fontFamily)} />
        <Row label="Font Size" value={`${Math.round(text.fontSizePx)}px`} />
        <Row
          label="Line Height"
          value={text.lineHeightPx == null ? "normal" : `${Math.round(text.lineHeightPx)}px`}
        />
        <Row label="Font Weight" value={`${weightLabel(text.fontWeight)} (${text.fontWeight})`} />
        <Row label="Letter Spacing" value={text.letterSpacing || "normal"} />
        <Row
          label="Text color"
          value={text.color}
          swatch={text.color}
          onCopy={() => copy(text.color)}
        />
      </section>
    </div>
  );
}

function weightLabel(w: number): string {
  if (w <= 300) return "Light";
  if (w === 400) return "Regular";
  if (w === 500) return "Medium";
  if (w === 600) return "Semibold";
  if (w === 700) return "Bold";
  if (w >= 800) return "Black";
  return "Custom";
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
  swatch?: string;
  onCopy?: () => void;
}
function Row({ label, value, mono, swatch, onCopy }: RowProps): JSX.Element {
  return (
    <div className="lpe-eli-row">
      <span className="lpe-eli-rowlabel">{label}</span>
      <span className={`lpe-eli-rowvalue${mono ? " is-mono" : ""}`}>
        {swatch && <span className="lpe-eli-swatch" style={{ background: swatch }} aria-hidden="true" />}
        <span className="lpe-eli-rowtext" title={value}>{value}</span>
        {onCopy && (
          <button
            type="button" className="lpe-eli-copy"
            onClick={onCopy} aria-label={`Copy ${label}`} title={`Copy ${label}`}
          >⎘</button>
        )}
      </span>
    </div>
  );
}

function BoxModel({ snapshot }: { snapshot: ElementSnapshot }): JSX.Element {
  const { box } = snapshot;
  const r = (n: number): string => (n === 0 ? "-" : String(Math.round(n)));
  return (
    <div className="lpe-bm" aria-label="Box model">
      <div className="lpe-bm-margin">
        <span className="lpe-bm-tag">margin</span>
        <span className="lpe-bm-tl">{r(box.margin.top)}</span>
        <span className="lpe-bm-tr">{r(box.margin.right)}</span>
        <span className="lpe-bm-br">{r(box.margin.bottom)}</span>
        <span className="lpe-bm-bl">{r(box.margin.left)}</span>
        <div className="lpe-bm-border">
          <span className="lpe-bm-tag">border</span>
          <span className="lpe-bm-tl">{r(box.border.top)}</span>
          <span className="lpe-bm-tr">{r(box.border.right)}</span>
          <span className="lpe-bm-br">{r(box.border.bottom)}</span>
          <span className="lpe-bm-bl">{r(box.border.left)}</span>
          <div className="lpe-bm-padding">
            <span className="lpe-bm-tag">padding</span>
            <span className="lpe-bm-tl">{r(box.padding.top)}</span>
            <span className="lpe-bm-tr">{r(box.padding.right)}</span>
            <span className="lpe-bm-br">{r(box.padding.bottom)}</span>
            <span className="lpe-bm-bl">{r(box.padding.left)}</span>
            <div className="lpe-bm-content">
              {Math.round(box.content.w)} × {Math.round(box.content.h)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}