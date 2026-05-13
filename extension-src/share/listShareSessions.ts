/**
 * Smart Share session listing (v2.3 dashboard). Cookie-credentialed GET to the
 * WP plugin's `/sessions` endpoint with X-WP-Nonce. Returns the most recent
 * sessions for the signed-in user.
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl } from "@shared/shareSettings";
import type { ShareSettings } from "@shared/types";

export interface ShareSessionSummary {
  sessionId: string;
  kind: string;
  status: string;
  sourceUrl: string;
  prompt: string;
  createdAtIso: string;
  expiresAtIso: string;
  urls: { html: string; css: string; js: string; image: string };
}

export interface ListShareSessionsDeps {
  getShareSettings: () => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
}

export async function listShareSessions(
  deps: ListShareSessionsDeps,
): Promise<ShareSessionSummary[]> {
  const cfg = await deps.getShareSettings();
  if (!cfg.siteUrl || !cfg.nonce) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/sessions`;
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
      "WordPress session expired — sign in again.",
    );
  }
  if (!res.ok) {
    throw new MessageError(
      ErrorCode.E_SHARE_UPSTREAM,
      `WordPress error ${res.status}`,
    );
  }
  const raw = (await res.json()) as Array<Record<string, unknown>>;
  return raw.map((r) => ({
    sessionId: String(r.session_id ?? ""),
    kind: String(r.kind ?? ""),
    status: String(r.status ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    prompt: String(r.prompt ?? ""),
    createdAtIso: String(r.created_at ?? ""),
    expiresAtIso: String(r.expires_at ?? ""),
    urls: (r.urls as ShareSessionSummary["urls"]) ?? {
      html: "", css: "", js: "", image: "",
    },
  }));
}