/**
 * v2.2 Smart Share — WP plugin backend (cookie + nonce auth).
 * Split from shared/types.ts (S2).
 */
export interface ShareSettings {
  /** WP base URL the user typed (no trailing slash). */
  siteUrl: string;
  /** Latest known WP user id, or 0 when not signed in. */
  userId: number;
  /** Display name from /auth-status, or "". */
  displayName: string;
  /** Email from /auth-status, or "". */
  email: string;
  /** Latest fetched `wp_rest` nonce, or "". */
  nonce: string;
  /** ISO timestamp of last successful sign-in probe, or "". */
  signedInAtIso: string;
}

export type GetShareSettingsPayload = Record<string, never>;
export type GetShareSettingsResponse = ShareSettings;
export type SetShareSettingsPayload = Partial<ShareSettings>;
export type SetShareSettingsResponse = ShareSettings;

export interface CreateShareSessionPayload {
  /** "FullPage" | "Element" — sent verbatim to the WP plugin. */
  kind: string;
  sourceUrl: string;
  html: string;
  css: string;
  js: string;
  prompt?: string;
  /** PNG/JPEG bytes as base64 (no data: prefix). */
  imageBase64: string;
  imageMime: string;
}
export interface CreateShareSessionResponse {
  sessionId: string;
  expiresAt: string;
  urls: { html: string; css: string; js: string; image: string };
}

// ---- v2.2 sign-in probe ----
export type CheckShareAuthPayload = Record<string, never>;
export interface CheckShareAuthResponse {
  loggedIn: boolean;
  userId: number;
  displayName: string;
  email: string;
  nonce: string;
  quota?: {
    active: number; maxActive: number;
    hourlyUsed: number; maxHourly: number;
    lifetimeUsed: number;
    freeLimit: number;
    hasLicense: boolean;
  };
}

export interface OpenLoginPopupPayload { siteUrl: string }
export type OpenLoginPopupResponse = void;

export interface RevokeShareSessionPayload { sessionId: string }
export type RevokeShareSessionResponse = void;