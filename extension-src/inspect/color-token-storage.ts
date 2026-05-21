/**
 * Phase v2.7.5 — Per-snapshot persistence for Color Tokens edits.
 *
 * Stores `humanName` overrides and per-selector custom CSS blobs keyed by a
 * short snapshot id (hash of `url + collectedAt`). Uses its own
 * `chrome.storage.local` key so it never bloats the StorageRoot blob.
 */
import type { InspectSnapshot } from "./types";

export interface ColorTokenOverrides {
  /** Map of token name (`--ip-color-N`) → user-renamed human label. */
  humanNames: Record<string, string>;
  /** Map of selector → custom CSS body (declarations only, no `{ }`). */
  customCss: Record<string, string>;
}

export function emptyOverrides(): ColorTokenOverrides {
  return { humanNames: {}, customCss: {} };
}

/** Deterministic 8-char hash for the snapshot id. */
export function snapshotId(s: { pageInfo: { url: string }; collectedAt: number }): string {
  const seed = `${s.pageInfo.url}\u0000${s.collectedAt}`;
  // FNV-1a 32-bit (no crypto needed; collisions don't matter here).
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function keyFor(snap: InspectSnapshot): string {
  return `inspect-page:color-tokens:${snapshotId(snap)}`;
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome?.storage?.local;
}

export async function loadOverrides(snap: InspectSnapshot): Promise<ColorTokenOverrides> {
  if (!hasChromeStorage()) return emptyOverrides();
  try {
    const key = keyFor(snap);
    const items = await chrome.storage.local.get(key);
    const raw = items[key];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const r = raw as Partial<ColorTokenOverrides>;
      return {
        humanNames: r.humanNames && typeof r.humanNames === "object" ? { ...r.humanNames } : {},
        customCss: r.customCss && typeof r.customCss === "object" ? { ...r.customCss } : {},
      };
    }
  } catch { /* ignore */ }
  return emptyOverrides();
}

export async function saveOverrides(snap: InspectSnapshot, o: ColorTokenOverrides): Promise<void> {
  if (!hasChromeStorage()) return;
  try {
    await chrome.storage.local.set({ [keyFor(snap)]: o });
  } catch { /* ignore */ }
}