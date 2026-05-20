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
import type { ColorCategory } from "../../inspect/types";
import { DetailDrawer } from "./DetailDrawer";
import { colorsToCsv, safeBaseName, mimeFor } from "../../inspect/exportSnapshot";
import { downloadText } from "./downloadBlob";
import { sendToBackground } from "@shared/messaging";
import { MessageKind } from "@shared/enums";
import { InspectColorTokens } from "./InspectColorTokens";

export interface InspectColorsProps { snapshot: InspectSnapshot }

type Tab = "palette" | "categories" | "tokens";

export function InspectColors({ snapshot }: InspectColorsProps): JSX.Element {
  const [tab, setTab] = useState<Tab>("palette");
  const [copied, setCopied] = useState<string | null>(null);
  const [detail, setDetail] = useState<ColorUsage | null>(null);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);

  const palette = useMemo(() => dedupePalette(snapshot.colors), [snapshot.colors]);

  const onCopy = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1200);
    } catch { /* ignore */ }
  };

  const onLocate = async (value: string): Promise<void> => {
    // Phase A8b — forward to the active tab's content script. The CS scans
    // the live DOM, scrolls the first match into view, and flashes a ring
    // around every match. Failures must never break the panel.
    try {
      const res = await sendToBackground<
        { tabId: number; target: string },
        { count: number }
      >(MessageKind.LocateColor, { tabId: -1, target: value });
      const n = res.count;
      const tpl = n === 0
        ? COPY.inspectColorLocateNone
        : (n === 1 ? COPY.inspectColorLocateCount : COPY.inspectColorLocateCountPlural);
      setLocateMsg(format(tpl, { n, value }));
    } catch {
      setLocateMsg(format(COPY.inspectColorLocateError, { value }));
    }
    window.setTimeout(() => setLocateMsg((m) => (m && m.includes(value) ? null : m)), 2000);
  };

  const onOpenDetail = (color: ColorUsage): void => {
    if (color.category === "gradient") return; // gradients have no hex math
    setDetail(color);
  };

  const onExportAll = (): void => {
    const csv = colorsToCsv(snapshot.colors);
    const { mime, ext } = mimeFor("csv");
    downloadText(csv, `${safeBaseName(snapshot)}-colors.${ext}`, mime);
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
        <button
          type="button" role="tab" aria-selected={tab === "tokens"}
          className="lpe-subtab" data-active={tab === "tokens" ? "true" : "false"}
          onClick={() => setTab("tokens")}
        >
          {COPY.inspectColorsTokens}
        </button>
      </div>

      {tab === "palette" && (
        palette.length === 0
          ? <div className="lpe-inspect-empty"><span>{COPY.inspectColorsNone}</span></div>
          : <PaletteGrid items={palette} copied={copied} onCopy={onCopy} onLocate={onLocate} onOpenDetail={onOpenDetail} />
      )}
      {tab === "categories" && (
        <CategoriesView
          colors={snapshot.colors}
          copied={copied}
          onCopy={onCopy}
          onLocate={onLocate}
          onOpenDetail={onOpenDetail}
        />
      )}
      {tab === "tokens" && (
        <InspectColorTokens snapshot={snapshot} />
      )}
      {detail && <DetailDrawer color={detail} onClose={() => setDetail(null)} />}
      {locateMsg && (
        <div className="lpe-locate-toast" role="status" aria-live="polite">
          {locateMsg}
        </div>
      )}
    </section>
  );
}

/* -------------------- Categories view (Phase A5b) -------------------- */

const CATEGORY_ORDER: readonly ColorCategory[] = [
  "background", "text", "border", "fill", "stroke", "gradient", "shadow", "other",
];

function categoryLabel(c: ColorCategory): string {
  switch (c) {
    case "background": return COPY.inspectColorCatBackground;
    case "text": return COPY.inspectColorCatText;
    case "border": return COPY.inspectColorCatBorder;
    case "fill": return COPY.inspectColorCatFill;
    case "stroke": return COPY.inspectColorCatStroke;
    case "gradient": return COPY.inspectColorCatGradient;
    case "shadow": return COPY.inspectColorCatShadow;
    case "other": return COPY.inspectColorCatOther;
  }
}

interface CategoriesViewProps {
  colors: ColorUsage[];
  copied: string | null;
  onCopy: (v: string) => void;
  onLocate: (v: string) => void;
  onOpenDetail: (c: ColorUsage) => void;
}

function CategoriesView(props: CategoriesViewProps): JSX.Element {
  const { colors, copied, onCopy, onLocate, onOpenDetail } = props;
  const groups = useMemo(() => groupByCategory(colors), [colors]);

  if (colors.length === 0) {
    return <div className="lpe-inspect-empty"><span>{COPY.inspectColorsNone}</span></div>;
  }

  return (
    <div className="lpe-color-categories">
      {CATEGORY_ORDER.flatMap((cat) => {
        const items = groups.get(cat);
        if (!items || items.length === 0) return [];
        return [(
          <div key={cat} className="lpe-color-category">
            <header className="lpe-color-category-header">
              <span className="lpe-color-category-title">{categoryLabel(cat)}</span>
              <span className="lpe-color-category-count">{items.length}</span>
            </header>
            <div className="lpe-color-grid">
              {items.map((c) => (
                <ColorRow
                  key={`${cat}-${c.value}`}
                  color={c}
                  copied={copied === c.value}
                  onCopy={onCopy}
                  onLocate={onLocate}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          </div>
        )];
      })}
    </div>
  );
}

function groupByCategory(colors: ColorUsage[]): Map<ColorCategory, ColorUsage[]> {
  const out = new Map<ColorCategory, ColorUsage[]>();
  for (const c of colors) {
    const arr = out.get(c.category) ?? [];
    arr.push(c);
    out.set(c.category, arr);
  }
  for (const arr of out.values()) arr.sort((a, b) => b.instances - a.instances);
  return out;
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
  onOpenDetail: (c: ColorUsage) => void;
}

function PaletteGrid({ items, copied, onCopy, onLocate, onOpenDetail }: PaletteGridProps): JSX.Element {
  return (
    <div className="lpe-color-grid">
      {items.map((c) => (
        <ColorRow key={c.value} color={c} copied={copied === c.value} onCopy={onCopy} onLocate={onLocate} onOpenDetail={onOpenDetail} />
      ))}
    </div>
  );
}

interface ColorRowProps {
  color: ColorUsage;
  copied: boolean;
  onCopy: (v: string) => void;
  onLocate: (v: string) => void;
  onOpenDetail?: (c: ColorUsage) => void;
}

export function ColorRow({ color, copied, onCopy, onLocate, onOpenDetail }: ColorRowProps): JSX.Element {
  const clickable = !!onOpenDetail && color.category !== "gradient";
  return (
    <div className="lpe-color-row">
      {clickable ? (
        <button
          type="button"
          className={`lpe-color-swatch ${color.transparent ? "is-transparent" : ""}`}
          style={color.transparent ? undefined : { background: color.value }}
          onClick={() => onOpenDetail!(color)}
          aria-label={`Details for ${color.value}`}
          title={`Details for ${color.value}`}
        />
      ) : (
        <span
          className={`lpe-color-swatch ${color.transparent ? "is-transparent" : ""}`}
          style={color.transparent ? undefined : { background: color.value }}
          aria-hidden="true"
        />
      )}
      {clickable ? (
        <button
          type="button"
          className="lpe-color-hex lpe-color-hex-btn"
          onClick={() => onOpenDetail!(color)}
          title={color.value}
        >{color.value}</button>
      ) : (
        <span className="lpe-color-hex" title={color.value}>{color.value}</span>
      )}
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