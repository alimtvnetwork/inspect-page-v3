/**
 * Pure helper extracted from background.ts so we can unit-test the
 * Share Links upload pipeline without spinning up a service worker.
 * Source: spec/21-app/25-share-links.md.
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
      "Share Links is not paired. Paste a pairing token in Settings → Share Links.",
    );
  }
  const url = `${normalizeBaseUrl(cfg.siteUrl)}/wp-json/pageport/v1/sessions`;
  const auth = "Bearer " + cfg.pairingToken;

  const fd = new FormData();
  fd.append("kind", p.kind);
  fd.append("source_url", p.sourceUrl);
  fd.append("html", new Blob([p.html], { type: "text/html" }), "index.html");
  fd.append("css",  new Blob([p.css],  { type: "text/css"  }), "style.css");
  const imgBytes = base64ToBytes(p.imageBase64);
  const ext = p.imageMime.includes("jpeg") ? "jpg" : "png";
  fd.append("image", new Blob([imgBytes], { type: p.imageMime }), `screenshot.${ext}`);

  const fetchFn = deps.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchFn(url, { method: "POST", headers: { Authorization: auth }, body: fd });
  } catch (e) {
    throw new MessageError(
      ErrorCode.E_SHARE_NETWORK, "Could not reach WordPress site",
      e instanceof Error ? e.message : String(e),
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new MessageError(ErrorCode.E_SHARE_AUTH, "WordPress rejected the credentials");
  }
  if (res.status === 429) {
    throw new MessageError(
      ErrorCode.E_SHARE_QUOTA,
      "Active share-link quota reached. Revoke old links in WordPress and try again.",
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
    urls: { html: string; css: string; image: string };
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