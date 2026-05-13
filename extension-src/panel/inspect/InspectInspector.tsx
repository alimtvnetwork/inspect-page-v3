/**
 * Phase A8 — Element Inspector.
 *
 * Lists the most prominent visible elements from the snapshot, sorted by
 * on-screen area (largest first). Each row shows a short selector, a tag
 * chip, and the bounding-box dimensions; clicking a row expands an inline
 * computed-styles table. A "Copy selector" affordance writes to clipboard.
 *
 * Pure presentation — operates on `snapshot.computedSamples` (already
 * captured by Phase A2). On-page hover/picker integration arrives in A8b.
 */
import { useMemo, useState } from "react";
import { COPY } from "@shared/copy";
import { format } from "../format";
import type { ComputedSample, InspectSnapshot } from "../../inspect/types";
import { distanceBetween } from "../../inspect/distance";

const INITIAL_VISIBLE = 8;
const STYLE_ORDER: Array<keyof ComputedSample["styles"]> = [
  "display", "position",
  "color", "backgroundColor",
  "fontFamily", "fontSize", "fontWeight", "lineHeight",
  "margin", "padding", "border",
];

export interface InspectInspectorProps { snapshot: InspectSnapshot }

export function InspectInspector({ snapshot }: InspectInspectorProps): JSX.Element {
  const samples = useMemo(() => rankSamples(snapshot.computedSamples), [snapshot.computedSamples]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [anchorIdx, setAnchorIdx] = useState<number | null>(null);

  const visible = showAll ? samples : samples.slice(0, INITIAL_VISIBLE);
  const anchor = anchorIdx !== null ? samples[anchorIdx] ?? null : null;

  const toggle = (i: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const copySelector = async (i: number, selector: string): Promise<void> => {
    try { await navigator.clipboard.writeText(selector); } catch { /* ignore */ }
    setCopied(i);
    window.setTimeout(() => setCopied((cur) => (cur === i ? null : cur)), 1200);
  };

  return (
    <section className="lpe-inspector" aria-label={COPY.inspectInspectorTitle}>
      <header className="lpe-section-header">
        <h2 className="lpe-section-title">{COPY.inspectInspectorTitle}</h2>
      </header>

      {samples.length === 0 ? (
        <div className="lpe-inspect-empty"><span>{COPY.inspectInspectorEmpty}</span></div>
      ) : (
        <>
          <p className="lpe-inspector-hint">{COPY.inspectInspectorHint}</p>
          {anchor && (
            <div className="lpe-inspector-anchor-banner">
              <span title={anchor.selector}>
                {format(COPY.inspectInspectorAnchorBanner, { selector: anchor.selector })}
              </span>
              <button type="button" className="lpe-link" onClick={() => setAnchorIdx(null)}>
                {COPY.inspectInspectorClearAnchor}
              </button>
            </div>
          )}
          <ul className="lpe-inspector-list">
            {visible.map((s, i) => {
              const isOpen = expanded.has(i);
              const dims = format(COPY.inspectInspectorRect, { w: s.rect.w, h: s.rect.h });
              const isAnchor = anchorIdx === i;
              return (
                <li key={`${s.selector}-${i}`} className="lpe-inspector-item">
                  <button
                    type="button"
                    className={`lpe-inspector-row${isAnchor ? " is-anchor" : ""}`}
                    aria-expanded={isOpen}
                    onClick={() => toggle(i)}
                  >
                    <span className="lpe-inspector-tag">{s.tagName}</span>
                    <span className="lpe-inspector-selector" title={s.selector}>{s.selector}</span>
                    <span className="lpe-inspector-dims">{dims}</span>
                    <span className="lpe-inspector-caret" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && (
                    <div className="lpe-inspector-detail">
                      <dl className="lpe-inspector-styles">
                        {STYLE_ORDER.map((k) => {
                          const v = s.styles[k];
                          if (!v) return null;
                          return (
                            <div key={k} className="lpe-inspector-style-row">
                              <dt>{k}</dt>
                              <dd title={v}>{v}</dd>
                            </div>
                          );
                        })}
                      </dl>
                      {anchor && !isAnchor && (
                        <DistancePanel anchor={anchor.rect} target={s.rect} />
                      )}
                      {anchor && isAnchor && (
                        <p className="lpe-inspector-dist-self">{COPY.inspectInspectorDistSelf}</p>
                      )}
                      <button
                        type="button"
                        className="lpe-link"
                        onClick={() => void copySelector(i, s.selector)}
                      >
                        {copied === i ? COPY.inspectInspectorCopied : COPY.inspectInspectorCopySelector}
                      </button>
                      <button
                        type="button"
                        className="lpe-link"
                        onClick={() => setAnchorIdx(isAnchor ? null : i)}
                      >
                        {isAnchor ? COPY.inspectInspectorClearAnchor : COPY.inspectInspectorAnchor}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {samples.length > INITIAL_VISIBLE && (
            <button
              type="button"
              className="lpe-link"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? COPY.inspectInspectorShowLess : COPY.inspectInspectorShowMore}
            </button>
          )}
        </>
      )}
    </section>
  );
}

interface DistancePanelProps { anchor: { x: number; y: number; w: number; h: number }; target: { x: number; y: number; w: number; h: number } }

function DistancePanel({ anchor, target }: DistancePanelProps): JSX.Element {
  const d = distanceBetween(anchor, target);
  return (
    <div className="lpe-inspector-dist" role="group" aria-label={COPY.inspectInspectorDistTitle}>
      <div className="lpe-inspector-dist-title">{COPY.inspectInspectorDistTitle}</div>
      <dl className="lpe-inspector-dist-grid">
        <DistRow label={COPY.inspectInspectorDistLeft} value={d.left} />
        <DistRow label={COPY.inspectInspectorDistRight} value={d.right} />
        <DistRow label={COPY.inspectInspectorDistTop} value={d.top} />
        <DistRow label={COPY.inspectInspectorDistBottom} value={d.bottom} />
        <DistRow label={COPY.inspectInspectorDistHGap} value={d.hGap} />
        <DistRow label={COPY.inspectInspectorDistVGap} value={d.vGap} />
      </dl>
      {d.overlap && (
        <span className="lpe-inspector-dist-chip">{COPY.inspectInspectorDistOverlap}</span>
      )}
    </div>
  );
}

function DistRow({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="lpe-inspector-dist-row">
      <dt>{label}</dt>
      <dd>{value}px</dd>
    </div>
  );
}

/**
 * Rank computed samples by visible area (descending), filtering zero-size
 * elements and `<html>`/`<body>` (rarely interesting in the inspector).
 */
export function rankSamples(samples: ComputedSample[]): ComputedSample[] {
  return samples
    .filter((s) => s.rect.w > 0 && s.rect.h > 0)
    .filter((s) => s.tagName !== "html" && s.tagName !== "body")
    .slice()
    .sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
}