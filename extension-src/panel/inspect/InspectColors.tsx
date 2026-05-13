/**
 * Phase A5 — Colors section, Palette tab.
 *
 * Header: "Colors {N}" + Export All. Tab strip Palette / Categories
 * (Categories arrives in A5b — placeholder for now).
 *
 * Palette tab: dedup'd grid of solid colors (gradients excluded — they get
 * their own section in A5b). Each row shows a swatch (checkerboard for
 * transparent), hex value, Locate (stub until A8b) and Copy.
 */
import { useMemo, useState } from "react";
import { COPY } from "@shared/copy";
import { format } from "../format";
import type { ColorUsage, InspectSnapshot } from "../../inspect/types";

export interface InspectColorsProps { snapshot: InspectSnapshot }

type Tab = "palette" | "categories";

export function InspectColors({ snapshot }: InspectColorsProps): JSX.Element {
  const [tab, setTab] = useState<Tab>("palette");
  const [copied, setCopied] = useState<string | null>(null);

  const palette = useMemo(() => dedupePalette(snapshot.colors), [snapshot.colors]);

  const onCopy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1200);
    } catch { /* ignore */ }
  };

  const onLocate = (_value: string): void => {
    // Locate (highlight matching elements on the page) lands in Phase A8b.
    // Stub no-op for now — the button keeps its place in the row.
  };

  const onExportAll = (): void => {
    // Hardened CSV/JSON export lands in Phase A11; quick CSV download for now.
    const csv = ["value,category,instances,transparent"]
      .concat(snapshot.colors.map((c) =>
        `${c.value},${c.category},${c.instances},${c.transparent}`,
      ))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inspect-page-colors.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="lpe-colors" aria-label="Colors">
      <header className="lpe-section-header">
        <h2 className="lpe-section-title">
          {format(COPY.inspectColorsTitle, { n: palette.length })}
        </h2>
        <button
          type="button" className="lpe-link"
          onClick={onExportAll}
          disabled={snapshot.colors.length === 0}
        >
          {COPY.inspectColorsExportAll}
        </button>
      </header>

      <div className="lpe-subtabs" role="tablist" aria-label="Color view">
        <button
          type="button" role="tab" aria-selected={tab === "palette"}
          className="lpe-subtab" data-active={tab === "palette" ? "true" : "false"}
          onClick={() => setTab("palette")}
        >
          {COPY.inspectColorsPalette}
        </button>
        <button
          type="button" role="tab" aria-selected={tab === "categories"}
          className="lpe-subtab" data-active={tab === "categories" ? "true" : "false"}
          onClick={() => setTab("categories")}
        >
          {COPY.inspectColorsCategories}
        </button>
      </div>

      {tab === "palette" && (
        palette.length === 0
          ? <div className="lpe-inspect-empty"><span>{COPY.inspectColorsNone}</span></div>
          : <PaletteGrid items={palette} copied={copied} onCopy={onCopy} onLocate={onLocate} />
      )}
      {tab === "categories" && (
        <div className="lpe-inspect-empty">
          <span>Categories view arrives in the next phase (A5b).</span>
        </div>
      )}
    </section>
  );
}

/** Collapse colors to unique hex values, summing instances across categories. */
function dedupePalette(colors: ColorUsage[]): ColorUsage[] {
  const map = new Map<string, ColorUsage>();
  for (const c of colors) {
    if (c.category === "gradient") continue;
    const cur = map.get(c.value);
    if (cur) cur.instances += c.instances;
    else map.set(c.value, { ...c });
  }
  return Array.from(map.values()).sort((a, b) => b.instances - a.instances);
}

interface PaletteGridProps {
  items: ColorUsage[];
  copied: string | null;
  onCopy: (v: string) => void;
  onLocate: (v: string) => void;
}

function PaletteGrid({ items, copied, onCopy, onLocate }: PaletteGridProps): JSX.Element {
  return (
    <div className="lpe-color-grid">
      {items.map((c) => (
        <ColorRow key={c.value} color={c} copied={copied === c.value} onCopy={onCopy} onLocate={onLocate} />
      ))}
    </div>
  );
}

interface ColorRowProps {
  color: ColorUsage;
  copied: boolean;
  onCopy: (v: string) => void;
  onLocate: (v: string) => void;
}

export function ColorRow({ color, copied, onCopy, onLocate }: ColorRowProps): JSX.Element {
  return (
    <div className="lpe-color-row">
      <span
        className={`lpe-color-swatch ${color.transparent ? "is-transparent" : ""}`}
        style={color.transparent ? undefined : { background: color.value }}
        aria-hidden="true"
      />
      <span className="lpe-color-hex" title={color.value}>{color.value}</span>
      <span className="lpe-color-instances">{color.instances}×</span>
      <button
        type="button" className="lpe-color-btn"
        onClick={() => onLocate(color.value)}
        aria-label={`${COPY.inspectColorLocate} ${color.value}`}
        title={COPY.inspectColorLocate}
      >
        ⌖
      </button>
      <button
        type="button" className="lpe-color-btn"
        onClick={() => onCopy(color.value)}
        aria-label={`${COPY.inspectColorCopy} ${color.value}`}
        title={copied ? COPY.inspectColorCopied : COPY.inspectColorCopy}
      >
        {copied ? "✓" : "⧉"}
      </button>
    </div>
  );
}