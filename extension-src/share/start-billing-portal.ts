/**
 * Open the Stripe-hosted Customer Portal for an existing Pro subscriber.
 *
 * Calls `POST /inspect-page/v1/billing/portal` (cookie + X-WP-Nonce) which
 * mints a Customer Portal session URL. Caller navigates the user to it.
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl } from "@shared/share-settings";
import type { ShareSettings } from "@shared/types";

export interface StartBillingPortalDeps {
  getShareSettings: () => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
  returnUrl?: string;
}

export interface BillingPortalResult { url: string }

export async function startBillingPortal(
  deps: StartBillingPortalDeps,
): Promise<BillingPortalResult> {
  const cfg = await deps.getShareSettings();
  if (!cfg.siteUrl || !cfg.nonce) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/billing/portal`;
  const fetchFn = deps.fetchImpl ?? fetch;
  const body: Record<string, string> = {};
  if (deps.returnUrl) body.return_url = deps.returnUrl;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        "X-WP-Nonce": cfg.nonce,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
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
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "message" in json && typeof (json as { message: unknown }).message === "string")
        ? (json as { message: string }).message
        : `Billing portal failed (HTTP ${res.status})`;
    throw new MessageError(ErrorCode.E_SHARE_NETWORK, msg);
  }
  if (!json || typeof json !== "object" || typeof (json as { url?: unknown }).url !== "string") {
    throw new MessageError(ErrorCode.E_SHARE_NETWORK, "Stripe portal URL missing in response");
  }
  return { url: (json as { url: string }).url };
}