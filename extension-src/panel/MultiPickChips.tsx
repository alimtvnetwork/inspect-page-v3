/**
 * MultiPickChips — selected-elements chip row.
 * Extracted from ExportPanel.tsx (B1 r10).
 */
import type { StatusUpdatePayload } from "@shared/types";
import { asElementSnapshot } from "@shared/narrow";

function compactSelectorLabel(selectorPath: string): string {
  const parts = selectorPath.split(" > ").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || selectorPath;
}

export function pickDisplayLabel(
  pick: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>[number],
): { title: string; selector: string } {
  const snapshot = asElementSnapshot(pick.elementSnapshot);
  const friendly = snapshot?.identity?.label?.trim();
  const chip = snapshot?.identity?.selectorChip?.trim();
  const compact = compactSelectorLabel(pick.selectorPath).trim();
  return {
    title: friendly || chip || compact || `Element`,
    selector: chip && chip !== friendly ? chip : compact || pick.selectorPath,
  };
}

export interface MultiPickChipsProps {
  picks: NonNullable<StatusUpdatePayload["multiElementSnapshot"]>;
  activeIndex: number;
  onSelect: (idx: number) => void;
  onRemove: (idx: number) => void;
}

export function MultiPickChips({ picks, activeIndex, onSelect, onRemove }: MultiPickChipsProps): JSX.Element {
  return (
    <section aria-label="Selected elements" className="lpe-multi-picks">
      <div className="lpe-multi-picks-head">
        <span>Selected elements</span>
        <span className="lpe-multi-picks-count">{picks.length}</span>
      </div>
      <div className="lpe-multi-picks-list">
        {picks.map((p, idx) => {
          const active = idx === activeIndex;
          const label = pickDisplayLabel(p);
          return (
            <div
              key={`${idx}-${p.selectorPath}`}
              className="lpe-multi-pick"
              data-active={active ? "true" : "false"}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(idx)}
                title={p.selectorPath}
                className="lpe-multi-pick-main"
              >
                <span aria-hidden="true" className="lpe-multi-pick-index">{idx + 1}</span>
                <span className="lpe-multi-pick-copy">
                  <span className="lpe-multi-pick-label">{label.title}</span>
                  <span className="lpe-multi-pick-selector">{label.selector}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Remove pick ${idx + 1}`}
                onClick={() => onRemove(idx)}
                className="lpe-multi-pick-remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}