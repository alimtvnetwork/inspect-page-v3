/**
 * Phase v2.7.5 — Inspect → Colors → Tokens sub-tab.
 *
 * Renders the v2 token model (base + tint + shade + selector bindings) and
 * lets the user (a) rename the human label per token and (b) attach custom
 * CSS declarations to any selector. Both edits persist per snapshot via
 * {@link saveOverrides}.
 */
import { useEffect, useMemo, useState } from "react";
import { COPY } from "@shared/copy";
import { format } from "../format";
import type { InspectSnapshot } from "../../inspect/types";
import type { ColorCategory, ColorToken } from "../../inspect/types";
import { buildTokens } from "../../inspect/color-variants";
import { buildColorSelectorIndex } from "../../inspect/color-selector-index";
import {
  tokensToMarkdown, tokensToCssTokens, tokensToPerSelectorCss, tokensToJson,
  safeBaseName, mimeFor,
} from "../../inspect/export-snapshot";
import { downloadText } from "./download-blob";
import {
  loadOverrides, saveOverrides, emptyOverrides, type ColorTokenOverrides,
} from "../../inspect/color-token-storage";

export interface InspectColorTokensProps { snapshot: InspectSnapshot }

export function InspectColorTokens({ snapshot }: InspectColorTokensProps): JSX.Element {
  const palette = useMemo(() => dedupePalette(snapshot.colors), [snapshot.colors]);
  const baseTokens = useMemo(() => buildTokens(palette), [palette]);
  const selectorIndex = useMemo(() => buildColorSelectorIndex(snapshot.computedSamples), [snapshot.computedSamples]);

  const [overrides, setOverrides] = useState<ColorTokenOverrides>(emptyOverrides);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let isAborted = false;
    void loadOverrides(snapshot).then((o) => { if (!isAborted) setOverrides(o); });
    return () => { isAborted = true; };
  }, [snapshot]);

  // Apply user-renamed humanName overrides on top of the generated tokens.
  const tokens = useMemo(() => baseTokens.map((t) => ({
    ...t,
    humanName: overrides.humanNames[t.token] ?? t.humanName,
  })), [baseTokens, overrides.humanNames]);

  const persist = (next: ColorTokenOverrides): void => {
    setOverrides(next);
    void saveOverrides(snapshot, next);
  };

  const renameToken = (token: string, name: string): void => {
    const humanNames = { ...overrides.humanNames };
    if (name.trim()) humanNames[token] = name.trim(); else delete humanNames[token];
    persist({ ...overrides, humanNames });
  };

  const copy = (key: string, text: string): void => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    }).catch(() => {});
  };

  const base = safeBaseName(snapshot);
  const exportActions: Array<{ label: string; run: () => void }> = [
    { label: COPY.inspectTokensExportMd, run: () => {
      const { mime, ext } = mimeFor("md");
      downloadText(tokensToMarkdown(tokens, selectorIndex), `${base}-tokens.${ext}`, mime);
    } },
    { label: COPY.inspectTokensExportCss, run: () => {
      downloadText(tokensToCssTokens(tokens), `${base}-tokens.css`, "text/css;charset=utf-8");
    } },
    { label: COPY.inspectTokensExportSelectors, run: () => {
      downloadText(
        tokensToPerSelectorCss(tokens, selectorIndex, overrides.customCss),
        `${base}-selectors.css`, "text/css;charset=utf-8",
      );
    } },
    { label: COPY.inspectTokensExportJson, run: () => {
      const { mime, ext } = mimeFor("json");
      downloadText(tokensToJson(tokens, selectorIndex, overrides.customCss), `${base}-tokens.${ext}`, mime);
    } },
  ];

  if (tokens.length === 0) {
    return <div className="lpe-inspect-empty"><span>{COPY.inspectTokensNone}</span></div>;
  }

  const grouped = groupByCategory(tokens);

  return (
    <section className="lpe-tokens" aria-label="Color tokens">
      <header className="lpe-section-header">
        <h3 className="lpe-section-subtitle">
          {format(COPY.inspectTokensTitle, { n: tokens.length })}
        </h3>
        <div className="lpe-export-menu">
          <button
            type="button" className="lpe-link"
            aria-haspopup="menu" aria-expanded={exportOpen}
            onClick={() => setExportOpen((v) => !v)}
          >{COPY.inspectTokensExport} ▾</button>
          {exportOpen && (
            <ul className="lpe-export-menu-pop" role="menu">
              {exportActions.map((e) => (
                <li key={e.label}>
                  <button
                    type="button" role="menuitem" className="lpe-export-menu-item"
                    onClick={() => { e.run(); setExportOpen(false); }}
                  >{e.label}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {grouped.map(([cat, list]) => (
        <div key={cat} className="lpe-token-group">
          <h4 className="lpe-token-group-title">{SECTION_TITLE[cat]}</h4>
          <div className="lpe-token-table" role="list" aria-label={SECTION_TITLE[cat]}>
            {list.map((t) => {
              const allKey = `${t.token}:all`;
              const allText = `${t.token}  ${t.humanName}\n${t.base.hex}\n${t.base.rgb}\n${t.base.hsl}`;
              const cells: Array<{ k: "hex" | "rgb" | "hsl"; v: string }> = [
                { k: "hex", v: t.base.hex },
                { k: "rgb", v: t.base.rgb },
                { k: "hsl", v: t.base.hsl },
              ];
              return (
                <div key={t.token} className="lpe-token-card" role="listitem">
                  <div className="lpe-token-card-head">
                    <span
                      className="lpe-token-swatch"
                      style={{ background: t.base.hex }}
                      aria-hidden="true"
                    />
                    <code className="lpe-token-name">{t.token}</code>
                    <input
                      type="text"
                      className="lpe-token-rename"
                      defaultValue={t.humanName}
                      placeholder={COPY.inspectTokensRenamePh}
                      onBlur={(e) => {
                        if (e.target.value !== t.humanName) renameToken(t.token, e.target.value);
                      }}
                      aria-label={`Rename ${t.token}`}
                    />
                  </div>
                  <div className="lpe-token-card-body">
                    {cells.map((c) => {
                      const key = `${t.token}:${c.k}`;
                      return (
                        <button
                          key={c.k}
                          type="button"
                          className="lpe-token-cell"
                          onClick={() => copy(key, c.v)}
                          title={`Click to copy ${c.k.toUpperCase()}`}
                        >
                          <span className="lpe-token-cell-label">{c.k.toUpperCase()}</span>
                          <span className="lpe-token-cell-value">{c.v}</span>
                          {copied === key && <span className="lpe-token-cell-hint">✓</span>}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="lpe-token-cell lpe-token-cell-all"
                      onClick={() => copy(allKey, allText)}
                      title="Copy HEX, RGB and HSL"
                    >{copied === allKey ? "Copied ✓" : "Copy all"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

const SECTION_TITLE: Record<ColorCategory, string> = {
  background: "Surfaces (backgrounds)",
  border: "Borders",
  text: "Text",
  fill: "Fills",
  stroke: "Strokes",
  shadow: "Shadows",
  gradient: "Gradients",
  other: "Other",
};

const GROUP_ORDER: ColorCategory[] = [
  "background", "border", "text", "fill", "stroke", "shadow", "gradient", "other",
];

function groupByCategory(tokens: readonly ColorToken[]): Array<[ColorCategory, ColorToken[]]> {
  const map = new Map<ColorCategory, ColorToken[]>();
  for (const t of tokens) {
    const arr = map.get(t.category) ?? [];
    arr.push(t);
    map.set(t.category, arr);
  }
  const out: Array<[ColorCategory, ColorToken[]]> = [];
  for (const cat of GROUP_ORDER) {
    const list = map.get(cat);
    if (list && list.length > 0) out.push([cat, list]);
  }
  return out;
}

/** Same dedup logic as InspectColors — kept private to avoid an export ripple. */
function dedupePalette(colors: InspectSnapshot["colors"]): InspectSnapshot["colors"] {
  const map = new Map<string, InspectSnapshot["colors"][number]>();
  for (const c of colors) {
    if (c.category === "gradient") continue;
    const cur = map.get(c.value);
    if (cur) cur.instances += c.instances;
    else map.set(c.value, { ...c });
  }
  return Array.from(map.values()).sort((a, b) => b.instances - a.instances);
}