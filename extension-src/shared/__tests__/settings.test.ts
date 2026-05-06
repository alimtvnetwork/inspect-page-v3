import { describe, expect, it, vi } from "vitest";
import { createSettingsFacade, type Scheduler } from "../settings";
import type { StorageDriver } from "../storage";
import { DEFAULT_SETTINGS } from "../defaults";
import { STORAGE_ROOT_KEY } from "../constants";

const memoryDriver = (): { driver: StorageDriver; store: Map<string, unknown> } => {
  const store = new Map<string, unknown>();
  return {
    store,
    driver: {
      async get(key) {
        const v = store.get(key);
        return v === undefined ? {} : { [key]: v };
      },
      async set(items) {
        for (const [k, v] of Object.entries(items)) store.set(k, v);
      },
    },
  };
};

const immediateScheduler = (): Scheduler => ({
  schedule(fn) { fn(); return null; },
  cancel() { /* noop */ },
});

const manualScheduler = (): Scheduler & { run(): void } => {
  let queued: (() => void) | null = null;
  return {
    schedule(fn) { queued = fn; return Symbol(); },
    cancel() { queued = null; },
    run() { const f = queued; queued = null; if (f) f(); },
  };
};

describe("settings facade", () => {
  it("returns defaults on first read and persists them", async () => {
    const { driver, store } = memoryDriver();
    const f = createSettingsFacade({ driver, scheduler: immediateScheduler() });
    const s = await f.getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(store.get(STORAGE_ROOT_KEY)).toBeDefined();
  });

  it("setSettings merges patch and persists", async () => {
    const { driver } = memoryDriver();
    const f = createSettingsFacade({ driver, scheduler: immediateScheduler() });
    const s = await f.setSettings({ jpegQuality: 70, imageFormat: "jpeg" });
    expect(s.jpegQuality).toBe(70);
    expect(s.imageFormat).toBe("jpeg");
    expect(s.redactPasswordFields).toBe(DEFAULT_SETTINGS.redactPasswordFields);
    const again = await f.getSettings();
    expect(again.jpegQuality).toBe(70);
  });

  it("debounces multiple writes into one persist", async () => {
    const { driver } = memoryDriver();
    const setSpy = vi.spyOn(driver, "set");
    const sched = manualScheduler();
    const f = createSettingsFacade({ driver, scheduler: sched });
    const p1 = f.setSettings({ jpegQuality: 70 });
    const p2 = f.setSettings({ jpegQuality: 80 });
    const p3 = f.setSettings({ jpegQuality: 90 });
    sched.run();
    await Promise.all([p1, p2, p3]);
    expect(setSpy).toHaveBeenCalledTimes(1);
    const final = await f.getSettings();
    expect(final.jpegQuality).toBe(90);
  });

  it("recovers from corrupted root by rewriting defaults", async () => {
    const { driver, store } = memoryDriver();
    store.set(STORAGE_ROOT_KEY, { not: "valid" });
    const f = createSettingsFacade({ driver, scheduler: immediateScheduler() });
    const s = await f.getSettings();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("migrates older schemaVersion by resetting to defaults", async () => {
    const { driver, store } = memoryDriver();
    store.set(STORAGE_ROOT_KEY, {
      schemaVersion: 0,
      settings: { ...DEFAULT_SETTINGS, jpegQuality: 50 },
      panelPosition: { xPx: 0, yPx: 0, minimized: false },
    });
    const f = createSettingsFacade({ driver, scheduler: immediateScheduler() });
    const s = await f.getSettings();
    expect(s.jpegQuality).toBe(DEFAULT_SETTINGS.jpegQuality);
  });

  it("panel position get/set roundtrip", async () => {
    const { driver } = memoryDriver();
    const f = createSettingsFacade({ driver, scheduler: immediateScheduler() });
    await f.setPanelPosition({ xPx: 200, yPx: 50 });
    const p = await f.getPanelPosition();
    expect(p.xPx).toBe(200);
    expect(p.yPx).toBe(50);
    expect(p.minimized).toBe(false);
  });
});
