/**
 * Settings + panel position facade with debounced writes.
 * Source: spec/21-app/16-storage-schema.md.
 */
import { STORAGE_WRITE_DEBOUNCE_MS } from "./constants";
import { LogCategory } from "./enums";
import { logger } from "./logger";
import { readRoot, writeRoot, type StorageDriver } from "./storage";
import type { PanelPosition, Settings, StorageRoot } from "./types";

export interface SettingsFacade {
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  getPanelPosition(): Promise<PanelPosition>;
  setPanelPosition(patch: Partial<PanelPosition>): Promise<PanelPosition>;
  flush(): Promise<void>;
}

interface FacadeOpts {
  driver?: StorageDriver;
  debounceMs?: number;
  scheduler?: Scheduler;
}

export interface Scheduler {
  schedule(fn: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

const realScheduler: Scheduler = {
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export function createSettingsFacade(opts: FacadeOpts = {}): SettingsFacade {
  const debounceMs = opts.debounceMs ?? STORAGE_WRITE_DEBOUNCE_MS;
  const sched = opts.scheduler ?? realScheduler;
  let pending: StorageRoot | null = null;
  let handle: unknown = null;
  let pendingResolves: Array<() => void> = [];
  let chain: Promise<unknown> = Promise.resolve();

  const loadRoot = async (): Promise<StorageRoot> => {
    if (pending) return pending;
    return readRoot(opts.driver);
  };

  const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };

  const queueWrite = (next: StorageRoot): Promise<void> => {
    pending = next;
    if (handle !== null) sched.cancel(handle);
    return new Promise((resolve) => {
      pendingResolves.push(resolve);
      handle = sched.schedule(() => void flushNow(), debounceMs);
    });
  };

  const flushNow = async (): Promise<void> => {
    const toWrite = pending;
    const resolves = pendingResolves;
    pending = null;
    pendingResolves = [];
    handle = null;
    if (!toWrite) return;
    await persist(toWrite, opts.driver);
    resolves.forEach((r) => r());
  };

  return {
    getSettings: () => serialize(async () => (await loadRoot()).settings),
    setSettings: (patch) =>
      serialize(async () => {
        const root = await loadRoot();
        const next: StorageRoot = { ...root, settings: { ...root.settings, ...patch } };
        void queueWrite(next);
        return next.settings;
      }),
    getPanelPosition: () => serialize(async () => (await loadRoot()).panelPosition),
    setPanelPosition: (patch) =>
      serialize(async () => {
        const root = await loadRoot();
        const next: StorageRoot = { ...root, panelPosition: { ...root.panelPosition, ...patch } };
        void queueWrite(next);
        return next.panelPosition;
      }),
    flush: flushNow,
  };
}

async function persist(root: StorageRoot, driver?: StorageDriver): Promise<void> {
  try {
    await writeRoot(root, driver);
  } catch (e) {
    logger.error(LogCategory.Storage, "E_STORAGE_WRITE", "persist failed", e);
  }
}
