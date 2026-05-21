/**
 * Smart Share revoke (v2.2). Cookie-credentialed DELETE to the WP plugin
 * with X-WP-Nonce. 404 is treated as success (idempotent revoke).
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl } from "@shared/share-settings";
import type { ShareSettings } from "@shared/types";

export interface RevokeShareSessionDeps {
  getShareSettings: () => Promise<ShareSettings>;
  setShareSettings?: (patch: Partial<ShareSettings>) => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
}

export async function revokeShareSession(
  sessionId: string,
  deps: RevokeShareSessionDeps,
): Promise<void> {
  const cfg = await deps.getShareSettings();
  if (!cfg.siteUrl || !cfg.nonce) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/sessions/${encodeURIComponent(sessionId)}`;
  const fetchFn = deps.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "DELETE",
      headers: { "X-WP-Nonce": cfg.nonce },
      credentials: "include",
    });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_SHARE_NETWORK, "Could not reach WordPress site",
      e instanceof Error ? e.message : String(e),
    );
  }
  if (res.status === 401 || res.status === 403) {
    if (deps.setShareSettings) {
      try {
        await deps.setShareSettings({
          nonce: "", userId: 0, displayName: "", email: "", signedInAtIso: "",
        });
      } catch { /* ignore */ }
    }
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "WordPress session expired — sign in again.",
    );
  }
  // 404 = already gone; treat as success (idempotent revoke).
  if (!res.ok && res.status !== 404) {
    throw new MessageError(
      ErrorCode.E_SHARE_UPSTREAM, `WordPress error ${res.status}`,
    );
  }
}