/**
 * Share Links credentials, stored separately from the main settings root
 * so a corrupted main blob never leaks WP credentials into a reset cycle.
 * Source: spec/21-app/25-share-links.md §F.
 */
import { STORAGE_SHARE_KEY } from "./constants";
import type { ShareSettings } from "./types";

export const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  baseUrl: "",
  username: "",
  appPassword: "",
};

function isShareSettings(v: unknown): v is ShareSettings {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.baseUrl === "string"
    && typeof o.username === "string"
    && typeof o.appPassword === "string";
}

export async function getShareSettings(): Promise<ShareSettings> {
  const items = await chrome.storage.local.get(STORAGE_SHARE_KEY);
  const raw = items[STORAGE_SHARE_KEY];
  return isShareSettings(raw) ? raw : { ...DEFAULT_SHARE_SETTINGS };
}

export async function setShareSettings(patch: Partial<ShareSettings>): Promise<ShareSettings> {
  const current = await getShareSettings();
  const next: ShareSettings = { ...current, ...patch };
  await chrome.storage.local.set({ [STORAGE_SHARE_KEY]: next });
  return next;
}

export function shareConfigured(s: ShareSettings): boolean {
  return Boolean(s.baseUrl && s.username && s.appPassword);
}

/** Normalize base URL: trim trailing slash. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}