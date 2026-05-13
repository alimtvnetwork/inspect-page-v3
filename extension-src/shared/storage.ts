/**
 * chrome.storage.local facade. Atomic read-modify-write of the single root key.
 * Source: spec/21-app/16-storage-schema.md.
 */
import { CURRENT_SCHEMA_VERSION, STORAGE_ROOT_KEY } from "./constants";
import { ErrorCode, LogCategory } from "./enums";
import { logger } from "./logger";
import { buildDefaultStorageRoot } from "./defaults";
import type { StorageRoot } from "./types";

export interface StorageDriver {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

const chromeDriver: StorageDriver = {
  get: (key) => chrome.storage.local.get(key),
  set: (items) => chrome.storage.local.set(items),
};

// One-time migration of legacy `pageport` / `pageport.share` chrome.storage
// keys to the new `inspect-page` / `inspect-page.share` names. Runs at most
// once per session — no-op after migration is complete.
const LEGACY_KEYS = ["pageport", "pageport.share"] as const;
const NEW_KEYS    = ["inspect-page", "inspect-page.share"] as const;
let legacyMigrationDone = false;
async function migrateLegacyKeys(driver: StorageDriver): Promise<void> {
  if (legacyMigrationDone) return;
  legacyMigrationDone = true;
  try {
    for (let i = 0; i < LEGACY_KEYS.length; i++) {
      const oldKey = LEGACY_KEYS[i];
      const newKey = NEW_KEYS[i];
      const both = await driver.get(oldKey);
      const oldVal = (both as Record<string, unknown>)[oldKey];
      if (oldVal === undefined) continue;
      const existing = await driver.get(newKey);
      if ((existing as Record<string, unknown>)[newKey] === undefined) {
        await driver.set({ [newKey]: oldVal });
      }
      try { await chrome.storage.local.remove(oldKey); } catch { /* ignore */ }
    }
  } catch { /* best-effort */ }
}

export function readRoot(driver: StorageDriver = chromeDriver): Promise<StorageRoot> {
  return readRootSafely(driver);
}

async function readRootSafely(driver: StorageDriver): Promise<StorageRoot> {
  await migrateLegacyKeys(driver);
  const raw = await readRaw(driver);
  if (!isStorageRoot(raw)) {
    return resetToDefaults(driver, raw === undefined ? "missing" : "invalid");
  }
  return migrateIfNeeded(driver, raw);
}

async function readRaw(driver: StorageDriver): Promise<unknown> {
  try {
    const items = await driver.get(STORAGE_ROOT_KEY);
    return items[STORAGE_ROOT_KEY];
  } catch (e) {
    logger.error(LogCategory.Storage, ErrorCode.E_STORAGE_PARSE, "read failed", e);
    return undefined;
  }
}

async function resetToDefaults(driver: StorageDriver, reason: string): Promise<StorageRoot> {
  if (reason === "invalid") {
    logger.error(LogCategory.Storage, ErrorCode.E_STORAGE_PARSE, "rewriting defaults");
  }
  const fresh = buildDefaultStorageRoot();
  await driver.set({ [STORAGE_ROOT_KEY]: fresh });
  return fresh;
}

async function migrateIfNeeded(driver: StorageDriver, root: StorageRoot): Promise<StorageRoot> {
  if (root.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return root;
  }
  return resetToDefaults(driver, "schema-bump");
}

export async function writeRoot(root: StorageRoot, driver: StorageDriver = chromeDriver): Promise<void> {
  await driver.set({ [STORAGE_ROOT_KEY]: root });
}

function isStorageRoot(value: unknown): value is StorageRoot {
  if (!isObject(value)) return false;
  if ((value as { schemaVersion?: unknown }).schemaVersion !== CURRENT_SCHEMA_VERSION) return false;
  if (!isObject((value as { settings?: unknown }).settings)) return false;
  if (!isObject((value as { panelPosition?: unknown }).panelPosition)) return false;
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
