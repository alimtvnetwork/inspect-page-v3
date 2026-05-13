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

  const visible = showAll ? samples : samples.slice(0, INITIAL_VISIBLE);

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
          <ul className="lpe-inspector-list">
            {visible.map((s, i) => {
              const isOpen = expanded.has(i);
              const dims = format(COPY.inspectInspectorRect, { w: s.rect.w, h: s.rect.h });
              return (
                <li key={`${s.selector}-${i}`} className="lpe-inspector-item">
                  <button
                    type="button"
                    className="lpe-inspector-row"
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
                      <button
                        type="button"
                        className="lpe-link"
                        onClick={() => void copySelector(i, s.selector)}
                      >
                        {copied === i ? COPY.inspectInspectorCopied : COPY.inspectInspectorCopySelector}
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