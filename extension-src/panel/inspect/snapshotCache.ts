/**
 * Phase v2.7.5 — shared in-memory cache for the most recent Inspect
 * snapshot. Lives outside <InspectShell/> so other surfaces (ExportModes)
 * can opportunistically attach Color-Token addons to their MD/ZIP/Share
 * payloads without forcing a re-collection.
 */
import type { CollectInspectSnapshotResponse } from "@shared/types";

let cache: { key: string; data: CollectInspectSnapshotResponse } | null = null;

export const snapshotCache = {
  get(): typeof cache { return cache; },
  set(v: typeof cache): void { cache = v; },
  clear(): void { cache = null; },
};