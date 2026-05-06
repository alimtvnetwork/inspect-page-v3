/**
 * Settings facade. Reads/merges/writes Settings via storage root.
 * Source: spec/21-app/16-storage-schema.md.
 */
import { DEFAULT_SETTINGS } from "./defaults";
import { readRoot, writeRoot, type StorageDriver } from "./storage";
import type { PanelPosition, Settings } from "./types";

export async function getSettings(driver?: StorageDriver): Promise<Settings> {
  const root = await readRoot(driver);
  return { ...DEFAULT_SETTINGS, ...root.settings };
}

export async function setSettings(
  patch: Partial<Settings>,
  driver?: StorageDriver,
): Promise<Settings> {
  const root = await readRoot(driver);
  const merged: Settings = sanitize({ ...root.settings, ...patch });
  await writeRoot({ ...root, settings: merged }, driver);
  return merged;
}

function sanitize(s: Settings): Settings {
  const q = Math.max(1, Math.min(100, Math.round(s.jpegQuality)));
  return { ...s, jpegQuality: q };
}

export async function getPanelPosition(driver?: StorageDriver): Promise<PanelPosition> {
  const root = await readRoot(driver);
  return { ...root.panelPosition };
}

export async function setPanelPosition(
  patch: Partial<PanelPosition>,
  driver?: StorageDriver,
): Promise<PanelPosition> {
  const root = await readRoot(driver);
  const merged: PanelPosition = { ...root.panelPosition, ...patch };
  await writeRoot({ ...root, panelPosition: merged }, driver);
  return merged;
}
