/**
 * Phase W5 — client wrapper for `GET /inspect-page/v1/workspaces`.
 *
 * Returns the workspaces the signed-in WP user belongs to so the extension
 * can render a workspace switcher / picker (BillingPanel, Recent Shares
 * filter, etc.). Mirrors the shape returned by InspectPage_Workspaces::list_for_user.
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl } from "@shared/shareSettings";
import type { ShareSettings } from "@shared/types";

export interface WorkspaceListItem {
  id: number;
  name: string;
  role: "owner" | "admin" | "member";
  licenseStatus: "free" | "active" | "past_due" | "canceled";
}

export interface ListWorkspacesDeps {
  getShareSettings: () => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
}

export async function listWorkspaces(
  deps: ListWorkspacesDeps,
): Promise<WorkspaceListItem[]> {
  const cfg = await deps.getShareSettings();
  if (!cfg.siteUrl || !cfg.nonce) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/workspaces`;
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
  // Older plugins (< v2.6.0) don't ship /workspaces — surface as empty list
  // so the caller can gracefully fall back to the legacy single-user UI.
  if (res.status === 404) return [];
  let json: unknown = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !json || typeof json !== "object") {
    throw new MessageError(
      ErrorCode.E_SHARE_NETWORK,
      `Workspace list failed (HTTP ${res.status})`,
    );
  }
  const raw = (json as { workspaces?: unknown }).workspaces;
  if (!Array.isArray(raw)) return [];
  const out: WorkspaceListItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const w = item as Record<string, unknown>;
    if (typeof w.id !== "number" || w.id <= 0) continue;
    const role = w.role === "owner" || w.role === "admin" ? w.role : "member";
    const ls = w.license_status === "active" || w.license_status === "past_due" || w.license_status === "canceled"
      ? w.license_status
      : "free";
    out.push({
      id: w.id,
      name: typeof w.name === "string" ? w.name : "",
      role,
      licenseStatus: ls,
    });
  }
  return out;
}
