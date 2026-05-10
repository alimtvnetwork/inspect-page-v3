/**
 * Share Links pairing-token storage. The user pastes a single
 * `PPT1.<payload>.<sig>` token; the WP site URL is decoded from the
 * payload at pair time so the user never types it manually.
 * Source: spec/21-app/25-share-links.md §F.
 */
import { STORAGE_SHARE_KEY } from "./constants";
import type { ShareSettings } from "./types";

export const DEFAULT_SHARE_SETTINGS: ShareSettings = {
  pairingToken: "",
  siteUrl: "",
  tokenId: "",
  pairedAtIso: "",
};

function isShareSettings(v: unknown): v is ShareSettings {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.pairingToken === "string"
    && typeof o.siteUrl === "string"
    && typeof o.tokenId === "string"
    && typeof o.pairedAtIso === "string";
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
  return Boolean(s.pairingToken && s.siteUrl);
}

/** Normalize base URL: trim trailing slash. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Decoded payload of a `PPT1.<payload>.<sig>` token. Signature is *not*
 * verified client-side — the WordPress server does that on each request. */
export interface ParsedPairingToken {
  siteUrl: string;
  tokenId: string;
  userId: number;
}

export function parsePairingToken(token: string): ParsedPairingToken | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed.startsWith("PPT1.")) return null;
  const parts = trimmed.slice(5).split(".");
  if (parts.length !== 2) return null;
  const json = b64urlDecodeToString(parts[0]);
  if (json === null) return null;
  let payload: unknown;
  try { payload = JSON.parse(json); } catch { return null; }
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (p.v !== 1) return null;
  if (typeof p.site !== "string" || typeof p.tid !== "string" || typeof p.uid !== "number") return null;
  return {
    siteUrl: normalizeBaseUrl(p.site),
    tokenId: p.tid,
    userId: p.uid,
  };
}

function b64urlDecodeToString(s: string): string | null {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const bin = atob(b64);
    // Decode UTF-8.
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch { return null; }
}