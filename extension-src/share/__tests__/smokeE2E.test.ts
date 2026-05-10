/**
 * In-sandbox end-to-end smoke test: simulates the WordPress REST surface
 * documented in spec/21-app/25-share-links.md and exercises the full
 * extension flow:
 *   1. WP admin "mints" a PPT1 pairing token (HMAC-signed payload).
 *   2. Extension parses + stores the token (parsePairingToken).
 *   3. Extension uploads 30 share sessions; each succeeds and returns
 *      html/css/image URLs that the simulated server can serve back.
 *   4. The 31st upload exceeds the per-token quota and surfaces 429 →
 *      MessageError(E_SHARE_QUOTA).
 *   5. After unpair (server-side token revoke), the next upload returns
 *      401 → MessageError(E_SHARE_AUTH).
 * The PHP plugin is not executed; this is a behavioural mirror used for
 * regression coverage when no live WP install is available.
 */
import { describe, it, expect } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { createShareSession } from "../createShareSession";
import { parsePairingToken } from "@shared/shareSettings";
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import type { CreateShareSessionPayload, ShareSettings } from "@shared/types";

const SITE_URL = "https://wp.example.test";
const SIGNING_KEY = "test-signing-key-do-not-use-in-prod";
const MAX_ACTIVE = 30;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mirror of PagePort_Pairing::mint() — payload + HMAC-SHA256 signature. */
function mintToken(opts: { tid: string; uid: number }): string {
  const payload = { v: 1, site: SITE_URL, tid: opts.tid, uid: opts.uid };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(
    createHmac("sha256", SIGNING_KEY).update(payloadB64).digest(),
  );
  return `PPT1.${payloadB64}.${sig}`;
}

interface StoredSession {
  id: string;
  tid: string;
  status: "Active" | "Revoked";
  expiresAt: number;
  assets: { html: Buffer; css: Buffer; image: Buffer };
}

/** Tiny in-memory mirror of the WP REST surface. */
function makeServer() {
  const sessions = new Map<string, StoredSession>();
  const revokedTokens = new Set<string>();

  function authBearer(headers: HeadersInit | undefined): { tid: string } | Response {
    const h = new Headers(headers);
    const auth = h.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return new Response("missing bearer", { status: 401 });
    const token = auth.slice(7);
    const parts = token.startsWith("PPT1.") ? token.slice(5).split(".") : [];
    if (parts.length !== 2) return new Response("bad token", { status: 401 });
    const expectedSig = b64url(createHmac("sha256", SIGNING_KEY).update(parts[0]).digest());
    if (expectedSig !== parts[1]) return new Response("bad sig", { status: 401 });
    const payload = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8")) as { tid: string };
    if (revokedTokens.has(payload.tid)) return new Response("revoked", { status: 401 });
    return { tid: payload.tid };
  }

  return async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const auth = authBearer(init?.headers);
    if (auth instanceof Response) return auth;

    if (url === `${SITE_URL}/wp-json/pageport/v1/sessions` && method === "POST") {
      const active = [...sessions.values()].filter(
        (s) => s.tid === auth.tid && s.status === "Active" && s.expiresAt > Date.now(),
      ).length;
      if (active >= MAX_ACTIVE) {
        return new Response(
          JSON.stringify({ code: "E_SHARE_QUOTA", message: "quota" }),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
      const fd = init!.body as FormData;
      const html = Buffer.from(await (fd.get("html") as Blob).arrayBuffer());
      const css  = Buffer.from(await (fd.get("css")  as Blob).arrayBuffer());
      const image = Buffer.from(await (fd.get("image") as Blob).arrayBuffer());
      const id = b64url(randomBytes(32)).slice(0, 43);
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      sessions.set(id, { id, tid: auth.tid, status: "Active", expiresAt, assets: { html, css, image } });
      const base = `${SITE_URL}/wp-json/pageport/v1/share/${id}`;
      return new Response(JSON.stringify({
        session_id: id,
        expires_at: new Date(expiresAt).toISOString(),
        urls: { html: `${base}/html`, css: `${base}/css`, image: `${base}/image` },
      }), { status: 201, headers: { "content-type": "application/json" } });
    }

    if (url === `${SITE_URL}/wp-json/pageport/v1/pairing/self` && method === "DELETE") {
      revokedTokens.add(auth.tid);
      return new Response(JSON.stringify({ tid: auth.tid, status: "Revoked" }), { status: 200 });
    }

    const m = url.match(/\/share\/([A-Za-z0-9_-]{43})\/(html|css|image)$/);
    if (m && method === "GET") {
      const s = sessions.get(m[1]);
      if (!s || s.status !== "Active") return new Response("not found", { status: 404 });
      const buf = s.assets[m[2] as "html" | "css" | "image"];
      return new Response(buf, { status: 200 });
    }

    return new Response("not found", { status: 404 });
  };
}

const payload: CreateShareSessionPayload = {
  kind: "FullPage",
  sourceUrl: "https://news.ycombinator.com/",
  html: "<html><body>hi</body></html>",
  css: "body{font-family:sans-serif}",
  imageBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
  imageMime: "image/png",
};

describe("end-to-end smoke (mock WP REST)", () => {
  it("mint → pair → 30 uploads → 31st quota → unpair → auth", async () => {
    const fetchImpl = makeServer() as unknown as typeof fetch;

    // 1. WP mints, user pastes into extension.
    const token = mintToken({ tid: "tok_smoke_1", uid: 7 });
    const parsed = parsePairingToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.siteUrl).toBe(SITE_URL);
    expect(parsed!.tokenId).toBe("tok_smoke_1");

    const cfg: ShareSettings = {
      pairingToken: token,
      siteUrl: parsed!.siteUrl,
      tokenId: parsed!.tokenId,
      pairedAtIso: new Date().toISOString(),
    };
    const deps = { getShareSettings: async () => cfg, fetchImpl };

    // 2. Upload exactly MAX_ACTIVE sessions.
    const created: string[] = [];
    for (let i = 0; i < MAX_ACTIVE; i += 1) {
      const r = await createShareSession(payload, deps);
      created.push(r.sessionId);
      expect(r.urls.html).toMatch(/\/wp-json\/pageport\/v1\/share\/.{43}\/html$/);
    }
    expect(new Set(created).size).toBe(MAX_ACTIVE);

    // 3. Each returned URL serves the uploaded asset back.
    const probe = await fetchImpl(created[0]
      ? `${SITE_URL}/wp-json/pageport/v1/share/${created[0]}/html`
      : "", { headers: { Authorization: `Bearer ${token}` } });
    expect(probe.status).toBe(200);
    expect(await probe.text()).toBe(payload.html);

    // 4. 31st upload trips the quota.
    await expect(createShareSession(payload, deps)).rejects.toMatchObject({
      code: ErrorCode.E_SHARE_QUOTA,
    } satisfies Partial<MessageError>);

    // 5. Unpair revokes the token; subsequent upload is auth-rejected.
    const unpair = await fetchImpl(`${SITE_URL}/wp-json/pageport/v1/pairing/self`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    expect(unpair.status).toBe(200);
    await expect(createShareSession(payload, deps)).rejects.toMatchObject({
      code: ErrorCode.E_SHARE_AUTH,
    } satisfies Partial<MessageError>);
  });

  it("rejects a token with a tampered signature at the server", async () => {
    const fetchImpl = makeServer() as unknown as typeof fetch;
    const good = mintToken({ tid: "tok_smoke_2", uid: 9 });
    const bad = good.slice(0, -4) + "AAAA"; // mutate sig
    const cfg: ShareSettings = {
      pairingToken: bad, siteUrl: SITE_URL, tokenId: "tok_smoke_2",
      pairedAtIso: new Date().toISOString(),
    };
    await expect(
      createShareSession(payload, { getShareSettings: async () => cfg, fetchImpl }),
    ).rejects.toMatchObject({ code: ErrorCode.E_SHARE_AUTH } satisfies Partial<MessageError>);
  });
});