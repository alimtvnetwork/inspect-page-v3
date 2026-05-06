import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_ROOT_KEY } from "../constants";
import { DEFAULT_SETTINGS } from "../defaults";
import { getSettings, setSettings } from "../settings";
import type { StorageDriver } from "../storage";

function makeMemoryDriver(): StorageDriver {
  let store: Record<string, unknown> = {};
  return {
    get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
    set: async (items: Record<string, unknown>) => {
      store = { ...store, ...items };
    },
  };
}

describe("settings facade", () => {
  let driver: StorageDriver;
  beforeEach(() => {
    driver = makeMemoryDriver();
  });

  it("returns defaults on first read", async () => {
    const s = await getSettings(driver);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("merges patch and persists", async () => {
    const s = await setSettings({ imageFormat: "jpeg", jpegQuality: 80 }, driver);
    expect(s.imageFormat).toBe("jpeg");
    expect(s.jpegQuality).toBe(80);
    const again = await getSettings(driver);
    expect(again.imageFormat).toBe("jpeg");
    expect(again.jpegQuality).toBe(80);
  });

  it("clamps jpegQuality into [1,100]", async () => {
    const tooHigh = await setSettings({ jpegQuality: 999 }, driver);
    expect(tooHigh.jpegQuality).toBe(100);
    const tooLow = await setSettings({ jpegQuality: 0 }, driver);
    expect(tooLow.jpegQuality).toBe(1);
  });

  it("preserves untouched fields across writes", async () => {
    await setSettings({ redactPasswordFields: false }, driver);
    const s = await setSettings({ imageFormat: "jpeg" }, driver);
    expect(s.redactPasswordFields).toBe(false);
    expect(s.imageFormat).toBe("jpeg");
  });

  it("does not pollute outside STORAGE_ROOT_KEY", async () => {
    await setSettings({ imageFormat: "jpeg" }, driver);
    const all = await driver.get(STORAGE_ROOT_KEY);
    expect(all[STORAGE_ROOT_KEY]).toBeDefined();
  });
});
