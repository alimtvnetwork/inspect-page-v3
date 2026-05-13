/**
 * Phase A4 — Typography section.
 *
 * Two cards (Headings / Body) summarising the most-used font in each group:
 * primary family + generic-fallback chip + "N weights · N text styles".
 * "Show all" opens a modal listing every font usage from the snapshot.
 */
import { useMemo, useState } from "react";
import { COPY } from "@shared/copy";
import { format } from "../format";
import type { FontUsage, InspectSnapshot } from "../../inspect/types";

export interface InspectTypographyProps { snapshot: InspectSnapshot }

export function InspectTypography({ snapshot }: InspectTypographyProps): JSX.Element {
  const [showAll, setShowAll] = useState(false);

  const heading = useMemo(() => topFont(snapshot.fonts, "heading"), [snapshot.fonts]);
  const body = useMemo(() => topFont(snapshot.fonts, "body"), [snapshot.fonts]);

  if (snapshot.fonts.length === 0) {
    return (
      <section className="lpe-typo" aria-label={COPY.inspectTypographyTitle}>
        <header className="lpe-section-header">
          <h2 className="lpe-section-title">{COPY.inspectTypographyTitle}</h2>
        </header>
        <div className="lpe-inspect-empty"><span>{COPY.inspectTypoNone}</span></div>
      </section>
    );
  }

  return (
    <section className="lpe-typo" aria-label={COPY.inspectTypographyTitle}>
      <header className="lpe-section-header">
        <h2 className="lpe-section-title">{COPY.inspectTypographyTitle}</h2>
        <button type="button" className="lpe-link" onClick={() => setShowAll(true)}>
          {COPY.inspectTypoShowAll}
        </button>
      </header>

      <div className="lpe-typo-grid">
        <FontCard label={COPY.inspectTypoHeadings} font={heading} />
        <FontCard label={COPY.inspectTypoBody} font={body} />
      </div>

      {showAll && (
        <FontsModal fonts={snapshot.fonts} onClose={() => setShowAll(false)} />
      )}
    </section>
  );
}

function topFont(fonts: FontUsage[], group: "heading" | "body"): FontUsage | null {
  return fonts.find((f) => f.group === group) ?? null;
}

function FontCard({ label, font }: { label: string; font: FontUsage | null }): JSX.Element {
  if (!font) {
    return (
      <div className="lpe-typo-card lpe-typo-card-empty">
        <span className="lpe-typo-card-label">{label}</span>
        <span className="lpe-typo-card-empty-text">—</span>
      </div>
    );
  }
  const styles = font.sizesPx.length;
  return (
    <div className="lpe-typo-card">
      <span className="lpe-typo-card-label">{label}</span>
      <span
        className="lpe-typo-card-family"
        style={{ fontFamily: font.stack }}
        title={font.stack}
      >
        {font.family}
      </span>
      <span className="lpe-typo-chip">{font.generic}</span>
      <span className="lpe-typo-meta">
        {format(COPY.inspectTypoWeights, { n: font.weights.length })}
        {" · "}
        {format(COPY.inspectTypoStyles, { n: styles })}
      </span>
    </div>
  );
}

function FontsModal({ fonts, onClose }: { fonts: FontUsage[]; onClose: () => void }): JSX.Element {
  return (
    <div className="lpe-modal-backdrop" role="dialog" aria-modal="true" aria-label={COPY.inspectTypoModalTitle}>
      <div className="lpe-modal">
        <header className="lpe-modal-header">
          <h3>{COPY.inspectTypoModalTitle}</h3>
          <button type="button" className="lpe-header-btn" onClick={onClose} aria-label={COPY.inspectClose}>✕</button>
        </header>
        <div className="lpe-modal-body">
          {fonts.map((f) => (
            <div key={`${f.group}-${f.family}`} className="lpe-typo-row">
              <span className="lpe-typo-row-group">{f.group}</span>
              <span className="lpe-typo-row-family" style={{ fontFamily: f.stack }}>{f.family}</span>
              <span className="lpe-typo-chip">{f.generic}</span>
              <span className="lpe-typo-meta">
                {f.weights.join(", ")} · {f.sizesPx.length} sizes · {f.sampleCount}×
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}