/**
 * Open the Stripe-hosted Checkout for Inspect Page Pro.
 *
 * Calls the WP plugin REST endpoint `POST /inspect-page/v1/billing/checkout`
 * (cookie + X-WP-Nonce) which mints a Stripe Checkout Session and returns
 * its hosted `url`. Caller is expected to navigate the user to that URL.
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl } from "@shared/shareSettings";
import type { ShareSettings } from "@shared/types";

export interface StartBillingCheckoutDeps {
  getShareSettings: () => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
  successUrl?: string;
  cancelUrl?: string;
  /** Workspace to upgrade (W4+). When omitted, the WP plugin picks the
   * user's primary workspace. */
  workspaceId?: number;
}

export interface BillingCheckoutResult {
  url: string;
  id: string;
}

export async function startBillingCheckout(
  deps: StartBillingCheckoutDeps,
): Promise<BillingCheckoutResult> {
  const cfg = await deps.getShareSettings();
  if (!cfg.siteUrl || !cfg.nonce) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/billing/checkout`;
  const fetchFn = deps.fetchImpl ?? fetch;
  const body: Record<string, string> = {};
  if (deps.successUrl) body.success_url = deps.successUrl;
  if (deps.cancelUrl) body.cancel_url = deps.cancelUrl;
  if (deps.workspaceId && deps.workspaceId > 0) {
    body.workspace_id = String(deps.workspaceId);
  }
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
        : `Billing checkout failed (HTTP ${res.status})`;
    throw new MessageError(ErrorCode.E_SHARE_NETWORK, msg);
  }
  if (!json || typeof json !== "object" || typeof (json as { url?: unknown }).url !== "string") {
    throw new MessageError(ErrorCode.E_SHARE_NETWORK, "Stripe Checkout URL missing in response");
  }
  const out = json as { url: string; id?: string };
  return { url: out.url, id: typeof out.id === "string" ? out.id : "" };
}