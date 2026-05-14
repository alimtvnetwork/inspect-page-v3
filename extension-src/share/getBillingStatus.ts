/**
 * Option C — Phase 2: client wrapper for `/billing/status`.
 *
 * Fetches the WP plugin's enriched billing status (plan, lifetime usage,
 * free limit, remaining quota, subscription id) using the cached cookie +
 * `X-WP-Nonce`. Used by the in-extension Pricing card / active-license
 * panel and the post-checkout poll.
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl } from "@shared/shareSettings";
import type { ShareSettings } from "@shared/types";

export interface BillingStatus {
  hasLicense: boolean;
  plan: "pro" | "free";
  configured: boolean;
  subscription: string;
  lifetimeUsed: number;
  freeLimit: number;
  /** null when on Pro (unlimited); otherwise free quota remaining. */
  remaining: number | null;
}

export interface GetBillingStatusDeps {
  getShareSettings: () => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
}

export async function getBillingStatus(
  deps: GetBillingStatusDeps,
): Promise<BillingStatus> {
  const cfg = await deps.getShareSettings();
  if (!cfg.siteUrl || !cfg.nonce) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/billing/status`;
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
  let json: unknown = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !json || typeof json !== "object") {
    throw new MessageError(
      ErrorCode.E_SHARE_NETWORK,
      `Billing status failed (HTTP ${res.status})`,
    );
  }
  const o = json as Record<string, unknown>;
  const hasLicense = Boolean(o.has_license);
  const plan = o.plan === "pro" ? "pro" : "free";
  const lifetimeUsed = typeof o.lifetime_used === "number" ? o.lifetime_used : 0;
  const freeLimit = typeof o.free_limit === "number" ? o.free_limit : 0;
  const remaining = o.remaining === null
    ? null
    : (typeof o.remaining === "number" ? o.remaining : Math.max(0, freeLimit - lifetimeUsed));
  return {
    hasLicense,
    plan,
    configured: Boolean(o.configured),
    subscription: typeof o.subscription === "string" ? o.subscription : "",
    lifetimeUsed,
    freeLimit,
    remaining: hasLicense ? null : remaining,
  };
}
