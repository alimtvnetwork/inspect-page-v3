/**
 * Option A — Phase 3: client wrapper for `/sessions/{id}/stats`.
 *
 * Owner-only stats lookup for a Smart Share session — returns aggregate
 * `views`, ISO `lastViewedAt`, and per-file breakdown (html/css/js/image).
 * Uses the cached cookie + `X-WP-Nonce` like the rest of the WP REST
 * client surface.
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl } from "@shared/share-settings";
import type { ShareSettings } from "@shared/types";

export interface SessionStats {
  sessionId: string;
  views: number;
  lastViewedAtIso: string | null;
  perFile: { html: number; css: number; js: number; image: number };
}

export interface GetSessionStatsDeps {
  getShareSettings: () => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
}

export async function getSessionStats(
  sessionId: string,
  deps: GetSessionStatsDeps,
): Promise<SessionStats> {
  if (!sessionId) {
    throw new MessageError(ErrorCode.E_SHARE_BAD_INPUT, "sessionId required");
  }
  const cfg = await deps.getShareSettings();
  if (!cfg.siteUrl || !cfg.nonce) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/sessions/${encodeURIComponent(sessionId)}/stats`;
  const fetchFn = deps.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "GET",
      headers: { "X-WP-Nonce": cfg.nonce, Accept: "application/json" },
      credentials: "include",
    });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_SHARE_NETWORK,
      "Could not reach WordPress site",
      e instanceof Error ? e.message : String(e),
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  if (res.status === 404) {
    throw new MessageError(ErrorCode.E_SHARE_NOT_FOUND, "Share session not found.");
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !json || typeof json !== "object") {
    throw new MessageError(
      ErrorCode.E_SHARE_NETWORK,
      `Stats fetch failed (HTTP ${res.status})`,
    );
  }
  const o = json as Record<string, unknown>;
  const per = (o.per_file as Record<string, unknown>) ?? {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    sessionId: typeof o.session_id === "string" ? o.session_id : sessionId,
    views: num(o.views),
    lastViewedAtIso: typeof o.last_viewed_at === "string" ? o.last_viewed_at : null,
    perFile: {
      html: num(per.html),
      css: num(per.css),
      js: num(per.js),
      image: num(per.image),
    },
  };
}