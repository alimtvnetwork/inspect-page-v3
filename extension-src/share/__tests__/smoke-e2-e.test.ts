/**
 * In-sandbox end-to-end smoke test (v2.2): mirrors the WordPress REST
 * surface documented in spec/21-app/25-share-links.md and exercises the
 * extension Smart Share flow:
 *   1. Extension is "signed in" (siteUrl + nonce + userId persisted).
 *   2. Uploads MAX_ACTIVE share sessions (html / css / js / image), each
 *      returning 4 share URLs.
 *   3. The next upload exceeds the per-user active quota → 429 →
 *      MessageError(E_SHARE_QUOTA).
 *   4. Server clears the WP cookie/nonce; subsequent upload returns
 *      401 → MessageError(E_SHARE_AUTH).
 * The PHP plugin is not executed; this is a behavioural mirror.
 */
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { createShareSession } from "../create-share-session";
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import type { CreateShareSessionPayload, ShareSettings } from "@shared/types";

const SITE_URL = "https://wp.example.test";
const NONCE = "nonce-abc";
const USER_ID = 7;
const MAX_ACTIVE = 30;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface StoredSession {
  id: string;
  uid: number;
  status: "Active" | "Revoked";
  expiresAt: number;
  assets: { html: Buffer; css: Buffer; js: Buffer; image: Buffer };
}

function makeServer() {
  const sessions = new Map<string, StoredSession>();
  const valid = { authed: true };

  function checkAuth(headers: HeadersInit | undefined): { uid: number } | Response {
    if (!valid.authed) return new Response("signed out", { status: 401 });
    const h = new Headers(headers);
    if (h.get("X-WP-Nonce") !== NONCE) return new Response("bad nonce", { status: 401 });
    return { uid: USER_ID };
  }

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const auth = checkAuth(init?.headers);
    if (auth instanceof Response) return auth;

    if (url === `${SITE_URL}/wp-json/inspect-page/v1/sessions` && method === "POST") {
      const active = [...sessions.values()].filter(
        (s) => s.uid === auth.uid && s.status === "Active" && s.expiresAt > Date.now(),
      ).length;
      if (active >= MAX_ACTIVE) {
        return new Response(JSON.stringify({ code: "E_SHARE_QUOTA", message: "quota" }),
          { status: 429, headers: { "content-type": "application/json" } });
      }
      const fd = init!.body as FormData;
      const html  = Buffer.from(await (fd.get("html")  as Blob).arrayBuffer());
      const css   = Buffer.from(await (fd.get("css")   as Blob).arrayBuffer());
      const js    = Buffer.from(await (fd.get("js")    as Blob).arrayBuffer());
      const image = Buffer.from(await (fd.get("image") as Blob).arrayBuffer());
      const id = b64url(randomBytes(32)).slice(0, 43);
      const sig = b64url(randomBytes(16)).slice(0, 22);
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      sessions.set(id, { id, uid: auth.uid, status: "Active", expiresAt,
        assets: { html, css, js, image } });
      const base = `${SITE_URL}/wp-json/inspect-page/v1/share/${id}.${sig}`;
      return new Response(JSON.stringify({
        session_id: id,
        expires_at: new Date(expiresAt).toISOString(),
        urls: {
          html:  `${base}/index.html`,
          css:   `${base}/style.css`,
          js:    `${base}/script.js`,
          image: `${base}/preview.png`,
        },
      }), { status: 201, headers: { "content-type": "application/json" } });
    }

    const m = url.match(/\/share\/([A-Za-z0-9_-]{43})(?:\.[A-Za-z0-9_-]{16,43})?\/(index\.html|style\.css|script\.js|preview\.png)$/);
    if (m && method === "GET") {
      const s = sessions.get(m[1]);
      if (!s || s.status !== "Active") return new Response("not found", { status: 404 });
      const map: Record<string, keyof StoredSession["assets"]> = {
        "index.html": "html", "style.css": "css", "script.js": "js", "preview.png": "image",
      };
      return new Response(s.assets[map[m[2]]], { status: 200 });
    }

    return new Response("not found", { status: 404 });
  };

  return { fakeFetch, signOut: () => { valid.authed = false; } };
}

const payload: CreateShareSessionPayload = {
  kind: "FullPage",
  sourceUrl: "https://news.ycombinator.com/",
  html: "<html><body>hi</body></html>",
  css: "body{font-family:sans-serif}",
  js: "console.log('hi')",
  imageBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
  imageMime: "image/png",
};

describe("end-to-end smoke (mock WP REST, cookie+nonce)", () => {
  it("signed-in → 30 uploads → 31st quota → signed-out → auth", async () => {
    const srv = makeServer();
    const fetchImpl = srv.fakeFetch as unknown as typeof fetch;

    const cfg: ShareSettings = {
      siteUrl: SITE_URL, userId: USER_ID,
      displayName: "Test User", email: "t@example.test",
      nonce: NONCE, signedInAtIso: new Date().toISOString(),
    };
    const deps = { getShareSettings: async () => cfg, fetchImpl };

    const created: string[] = [];
    const createdUrls: string[] = [];
    for (let i = 0; i < MAX_ACTIVE; i += 1) {
      const r = await createShareSession(payload, deps);
      created.push(r.sessionId);
      createdUrls.push(r.urls.html);
      // URLs are HMAC-signed: /share/{43-char id}.{22-char sig}/{slug}
      expect(r.urls.html).toMatch(/\/share\/[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{22}\/index\.html$/);
      expect(r.urls.js).toMatch(/\/share\/[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{22}\/script\.js$/);
    }
    expect(new Set(created).size).toBe(MAX_ACTIVE);

    // Consume the signed URL exactly as returned by the server, instead of
    // hand-building it from the session id.
    const probe = await fetchImpl(createdUrls[0], { headers: { "X-WP-Nonce": NONCE } });
    expect(probe.status).toBe(200);
    expect(await probe.text()).toBe(payload.html);

    await expect(createShareSession(payload, deps)).rejects.toMatchObject({
      code: ErrorCode.E_SHARE_QUOTA,
    } satisfies Partial<MessageError>);

    srv.signOut();
    await expect(createShareSession(payload, deps)).rejects.toMatchObject({
      code: ErrorCode.E_SHARE_AUTH,
    } satisfies Partial<MessageError>);
  });

  it("rejects upload when nonce header is missing/incorrect", async () => {
    const srv = makeServer();
    const fetchImpl = srv.fakeFetch as unknown as typeof fetch;
    const cfg: ShareSettings = {
      siteUrl: SITE_URL, userId: USER_ID,
      displayName: "x", email: "x@y.z",
      nonce: "wrong-nonce", signedInAtIso: new Date().toISOString(),
    };
    await expect(
      createShareSession(payload, { getShareSettings: async () => cfg, fetchImpl }),
    ).rejects.toMatchObject({ code: ErrorCode.E_SHARE_AUTH } satisfies Partial<MessageError>);
  });
});
