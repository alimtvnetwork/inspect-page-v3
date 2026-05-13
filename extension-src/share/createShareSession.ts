/**
 * Smart Share upload (v2.2). Cookie-credentialed POST to the WP plugin
 * with X-WP-Nonce. Sends 4 files (html / css / js / image).
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import { normalizeBaseUrl, shareConfigured } from "@shared/shareSettings";
import type {
  CreateShareSessionPayload,
  CreateShareSessionResponse,
  ShareSettings,
} from "@shared/types";

export interface CreateShareSessionDeps {
  getShareSettings: () => Promise<ShareSettings>;
  setShareSettings?: (patch: Partial<ShareSettings>) => Promise<ShareSettings>;
  fetchImpl?: typeof fetch;
}

export async function createShareSession(
  p: CreateShareSessionPayload,
  deps: CreateShareSessionDeps,
): Promise<CreateShareSessionResponse> {
  const cfg = await deps.getShareSettings();
  if (!shareConfigured(cfg)) {
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "Sign in to your WordPress site in Settings → Smart Share.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/inspect-page/v1/sessions`;

  const fd = new FormData();
  fd.append("kind", p.kind);
  fd.append("source_url", p.sourceUrl);
  if (p.prompt) fd.append("prompt", p.prompt);
  fd.append("html", new Blob([p.html], { type: "text/html" }), "index.html");
  fd.append("css",  new Blob([p.css],  { type: "text/css"  }), "style.css");
  fd.append("js",   new Blob([p.js],   { type: "application/javascript" }), "script.js");
  const imgBytes = base64ToBytes(p.imageBase64);
  const ext = p.imageMime.includes("jpeg") ? "jpg" : "png";
  fd.append("image", new Blob([imgBytes], { type: p.imageMime }), `preview.${ext}`);

  const fetchFn = deps.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: { "X-WP-Nonce": cfg.nonce },
      credentials: "include",
      body: fd,
    });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_SHARE_NETWORK, "Could not reach WordPress site",
      e instanceof Error ? e.message : String(e),
    );
  }
  if (res.status === 401 || res.status === 403) {
    // Stale nonce / signed out elsewhere — clear cached identity.
    if (deps.setShareSettings) {
      try {
        await deps.setShareSettings({ nonce: "", userId: 0, displayName: "", email: "", signedInAtIso: "" });
      } catch { /* ignore */ }
    }
    throw new MessageError(
      ErrorCode.E_SHARE_AUTH,
      "WordPress session expired — sign in again from Settings → Smart Share.",
    );
  }
  if (res.status === 402) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
    throw new MessageError(
      ErrorCode.E_SHARE_QUOTA_FREE,
      "Free quota reached. Upgrade to Inspect Page Pro to keep sharing.",
      detail,
    );
  }
  if (res.status === 429) {
    throw new MessageError(
      ErrorCode.E_SHARE_QUOTA,
      "Share quota reached. Revoke old links in WordPress and try again.",
    );
  }
  if (res.status >= 500) {
    throw new MessageError(ErrorCode.E_SHARE_UPSTREAM, `WordPress error ${res.status}`);
  }
  if (!res.ok) {
    const text = await safeText(res);
    throw new MessageError(
      ErrorCode.E_SHARE_BAD_INPUT,
      `WordPress refused upload (${res.status})`, text,
    );
  }
  const json = (await res.json()) as {
    session_id: string; expires_at: string;
    urls: { html: string; css: string; js: string; image: string };
  };
  return {
    sessionId: json.session_id,
    expiresAt: json.expires_at,
    urls: json.urls,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function safeText(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 500); } catch { return ""; }
}
