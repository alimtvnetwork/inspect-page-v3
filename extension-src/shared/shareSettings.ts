/**
 * v2.2 Smart Share — WordPress site config + cached identity.
 * The user enters a WP site URL and signs in via a popup; the extension
 * authenticates by sending the WP cookie (`credentials: 'include'`) plus
 * the `X-WP-Nonce` header from `/auth-status`.
 */
import { INSPECT_PAGE_WP_SITE_URL, STORAGE_SHARE_KEY } from "./constants";
import type { ShareSettings } from "./types";

export const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  siteUrl: INSPECT_PAGE_WP_SITE_URL,
  userId: 0,
  displayName: "",
  email: "",
  nonce: "",
  signedInAtIso: "",
};

function isShareSettings(v: unknown): v is ShareSettings {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.siteUrl === "string"
    && typeof o.userId === "number"
    && typeof o.displayName === "string"
    && typeof o.email === "string"
    && typeof o.nonce === "string"
    && typeof o.signedInAtIso === "string";
}

export async function getShareSettings(): Promise<ShareSettings> {
  const items = await chrome.storage.local.get(STORAGE_SHARE_KEY);
  const raw = items[STORAGE_SHARE_KEY];
  const base = isShareSettings(raw) ? raw : { ...DEFAULT_SHARE_SETTINGS };
  // Site URL is no longer user-editable: always force the baked-in value so
  // a stale persisted URL can never override the official backend.
  return { ...base, siteUrl: INSPECT_PAGE_WP_SITE_URL };
}

export async function setShareSettings(patch: Partial<ShareSettings>): Promise<ShareSettings> {
  const current = await getShareSettings();
  const next: ShareSettings = { ...current, ...patch, siteUrl: INSPECT_PAGE_WP_SITE_URL };
  await chrome.storage.local.set({ [STORAGE_SHARE_KEY]: next });
  return next;
}

/** True when we have a site URL AND a current sign-in (nonce + userId). */
export function shareConfigured(s: ShareSettings): boolean {
  return Boolean(s.siteUrl && s.nonce && s.userId);
}

/** Trim trailing slash. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Validate a user-supplied WP site URL. Returns normalised URL or null. */
export function parseSiteUrl(url: string): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return normalizeBaseUrl(u.origin + u.pathname.replace(/\/+$/, ""));
  } catch {
    return null;
  }
}
