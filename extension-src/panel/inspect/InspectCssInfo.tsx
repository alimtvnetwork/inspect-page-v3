/**
 * Phase A7 — CSS Information.
 *
 * Pure presentation of {@link CssStats} from the page snapshot. Renders a
 * compact stat grid: rule count, inlined CSS size, external sheets,
 * <style> tags, and unreachable (CORS-blocked) sheet count with a hint.
 */
import { COPY } from "@shared/copy";
import type { InspectSnapshot } from "../../inspect/types";

export interface InspectCssInfoProps { snapshot: InspectSnapshot }

export function InspectCssInfo({ snapshot }: InspectCssInfoProps): JSX.Element {
  const s = snapshot.cssStats;
  const empty = s.ruleCount === 0 && s.inlineStyleTagCount === 0 && s.externalSheetCount === 0;

  return (
    <section className="lpe-cssinfo" aria-label={COPY.inspectCssTitle}>
      <header className="lpe-section-header">
        <h2 className="lpe-section-title">{COPY.inspectCssTitle}</h2>
      </header>

      {empty ? (
        <div className="lpe-inspect-empty"><span>{COPY.inspectCssNone}</span></div>
      ) : (
        <>
          <div className="lpe-cssinfo-grid">
            <Stat label={COPY.inspectCssRules} value={formatNum(s.ruleCount)} />
            <Stat label={COPY.inspectCssSize} value={formatBytes(s.cssBytes)} />
            <Stat label={COPY.inspectCssExternalSheets} value={formatNum(s.externalSheetCount)} />
            <Stat label={COPY.inspectCssInlineTags} value={formatNum(s.inlineStyleTagCount)} />
          </div>
          {s.unreachableSheetCount > 0 && (
            <div className="lpe-cssinfo-warn" role="note">
              <strong>{COPY.inspectCssUnreachable}: {s.unreachableSheetCount}</strong>
              <span>{COPY.inspectCssUnreachableHint}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="lpe-cssinfo-stat">
      <span className="lpe-cssinfo-stat-value">{value}</span>
      <span className="lpe-cssinfo-stat-label">{label}</span>
    </div>
  );
}

function formatNum(n: number): string {
  return new Intl.NumberFormat(undefined).format(n);
}

/** Convert bytes → human-readable string (B / KB / MB) with 1 decimal where useful. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return kb >= 100 ? `${Math.round(kb)} KB` : `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}