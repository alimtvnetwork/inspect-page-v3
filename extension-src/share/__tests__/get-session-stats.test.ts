import { describe, it, expect, vi } from "vitest";
import { getSessionStats } from "../get-session-stats";
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import type { ShareSettings } from "@shared/types";

const validCfg: ShareSettings = {
  siteUrl: "https://example.com",
  userId: 42,
  displayName: "Alice",
  email: "alice@example.com",
  nonce: "abc123",
  signedInAtIso: "2025-01-01T00:00:00Z",
};
const emptyCfg: ShareSettings = {
  siteUrl: "", userId: 0, displayName: "", email: "", nonce: "", signedInAtIso: "",
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

describe("getSessionStats", () => {
  it("rejects empty sessionId with E_SHARE_BAD_INPUT", async () => {
    const fetchImpl = vi.fn();
    const p = getSessionStats("", { getShareSettings: async () => validCfg, fetchImpl });
    await expect(p).rejects.toBeInstanceOf(MessageError);
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_BAD_INPUT));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws E_SHARE_AUTH without nonce", async () => {
    const fetchImpl = vi.fn();
    const p = getSessionStats("sess-x", { getShareSettings: async () => emptyCfg, fetchImpl });
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_AUTH));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GETs /sessions/{id}/stats and parses response", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      session_id: "sess-aaa",
      views: 7,
      last_viewed_at: "2025-05-14T12:00:00+00:00",
      per_file: { html: 3, css: 2, js: 1, image: 1 },
    }));
    const out = await getSessionStats("sess-aaa", { getShareSettings: async () => validCfg, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/sessions/sess-aaa/stats");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["X-WP-Nonce"]).toBe("abc123");
    expect(init.credentials).toBe("include");
    expect(out).toEqual({
      sessionId: "sess-aaa",
      views: 7,
      lastViewedAtIso: "2025-05-14T12:00:00+00:00",
      perFile: { html: 3, css: 2, js: 1, image: 1 },
    });
  });

  it("zero-fills missing per_file keys", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      session_id: "sess-b", views: 0, last_viewed_at: null, per_file: {},
    }));
    const out = await getSessionStats("sess-b", { getShareSettings: async () => validCfg, fetchImpl });
    expect(out.perFile).toEqual({ html: 0, css: 0, js: 0, image: 0 });
    expect(out.lastViewedAtIso).toBeNull();
  });

  it("URL-encodes the session id", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      session_id: "a/b", views: 0, last_viewed_at: null, per_file: {},
    }));
    await getSessionStats("a/b", { getShareSettings: async () => validCfg, fetchImpl });
    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/sessions/a%2Fb/stats");
  });

  it("maps 401 to E_SHARE_AUTH", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({}, 401));
    const p = getSessionStats("sess-x", { getShareSettings: async () => validCfg, fetchImpl });
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_AUTH));
  });

  it("maps 404 to E_SHARE_NOT_FOUND", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({}, 404));
    const p = getSessionStats("sess-x", { getShareSettings: async () => validCfg, fetchImpl });
    await expect(p).rejects.toBeInstanceOf(MessageError);
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_NOT_FOUND));
  });

  it("maps fetch throw to E_SHARE_NETWORK", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    const p = getSessionStats("sess-x", { getShareSettings: async () => validCfg, fetchImpl });
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_NETWORK));
  });

  it("maps malformed body to E_SHARE_NETWORK", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 }));
    const p = getSessionStats("sess-x", { getShareSettings: async () => validCfg, fetchImpl });
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_NETWORK));
  });
});