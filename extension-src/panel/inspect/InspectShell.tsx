/**
 * Phase A1 placeholder for the Inspect Mode pane.
 *
 * Subsequent phases (A2–A14) replace this stub with the real inspector:
 * Overview, Typography, Colors, Contrast Scanner, CSS Information,
 * Element Inspector, Show Code drawer, etc.
 */
import { COPY } from "@shared/copy";

export function InspectShell(): JSX.Element {
  return (
    <div className="lpe-inspect-shell" role="region" aria-label={COPY.inspectModeTitle}>
      <div className="lpe-inspect-empty">
        <strong>{COPY.inspectModeTitle}</strong>
        <span>{COPY.inspectModePlaceholder}</span>
      </div>
    </div>
  );
}