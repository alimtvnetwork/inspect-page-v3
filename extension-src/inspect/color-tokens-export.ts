/**
 * Phase v2.7.5 — assemble the Color-Token addons embedded in every
 * downstream export (Pick Element MD, ZIP, MD+files, Smart Share, Full
 * Page). One pure builder + one async loader that pulls per-snapshot
 * overrides from {@link colorTokenStorage}.
 */
import type { InspectSnapshot, ColorUsage } from "./types";
import { buildTokens } from "./color-variants";
import { buildColorSelectorIndex } from "./color-selector-index";
import {
  tokensToMarkdown, tokensToCssTokens, tokensToPerSelectorCss,
} from "./export-snapshot";
import {
  loadOverrides, emptyOverrides, type ColorTokenOverrides,
} from "./color-token-storage";

export interface ColorTokenAddons {
  /** Markdown block: `## Color tokens` + `## Variants` + `## Selector map` + optional `## Custom CSS`. */
  mdBlock: string;
  /** Raw `tokens.css` body (`:root { --ip-color-… }`). */
  tokensCss: string;
  /** Raw `selectors.css` body (per-selector rules with `var(--ip-color-…)`). */
  selectorsCss: string;
  /** CSS-only dump of the user's per-selector custom blocks (no tokens). */
  customCssBlock: string;
  /** Number of tokens generated — used by callers that want a quick guard. */
  tokenCount: number;
}

const EMPTY: ColorTokenAddons = {
  mdBlock: "",
  tokensCss: "",
  selectorsCss: "",
  customCssBlock: "",
  tokenCount: 0,
};

export function buildColorTokenAddons(
  snapshot: InspectSnapshot,
  overrides: ColorTokenOverrides = emptyOverrides(),
): ColorTokenAddons {
  const palette = dedupePalette(snapshot.colors);
  const baseTokens = buildTokens(palette);
  if (baseTokens.length === 0 && Object.keys(overrides.customCss).length === 0) {
    return EMPTY;
  }
  const tokens = baseTokens.map((t) => ({
    ...t,
    humanName: overrides.humanNames[t.token] ?? t.humanName,
  }));
  const index = buildColorSelectorIndex(snapshot.computedSamples);

  const md = tokensToMarkdown(tokens, index);
  const tokensCss = tokens.length > 0 ? tokensToCssTokens(tokens) : "";
  const selectorsCss = tokensToPerSelectorCss(tokens, index, overrides.customCss);

  const customEntries = Object.entries(overrides.customCss)
    .filter(([, body]) => body.trim().length > 0);
  const customCssBlock = customEntries.length === 0
    ? ""
    : customEntries
        .map(([sel, body]) => `${sel} {\n  ${body.trim().replace(/\r?\n/g, "\n  ")}\n}`)
        .join("\n\n");

  const mdParts: string[] = [];
  if (md.trim()) mdParts.push(md.trim());
  if (customCssBlock) {
    mdParts.push(`## Custom CSS\n\n\`\`\`css\n${customCssBlock}\n\`\`\``);
  }
  return {
    mdBlock: mdParts.join("\n\n"),
    tokensCss,
    selectorsCss,
    customCssBlock,
    tokenCount: tokens.length,
  };
}

export async function loadColorTokenAddons(snapshot: InspectSnapshot): Promise<ColorTokenAddons> {
  const o = await loadOverrides(snapshot);
  return buildColorTokenAddons(snapshot, o);
}

export function emptyColorTokenAddons(): ColorTokenAddons { return EMPTY; }

function dedupePalette(colors: readonly ColorUsage[]): ColorUsage[] {
  const map = new Map<string, ColorUsage>();
  for (const c of colors) {
    if (c.category === "gradient") continue;
    const cur = map.get(c.value);
    if (cur) cur.instances += c.instances;
    else map.set(c.value, { ...c });
  }
  return Array.from(map.values()).sort((a, b) => b.instances - a.instances);
}