import { describe, it, expect, vi } from "vitest";
import { listShareSessions } from "../list-share-sessions";
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
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function expectMsgErr(p: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(MessageError);
  await p.catch((e) => expect((e as MessageError).code).toBe(code));
}

describe("listShareSessions", () => {
  it("throws E_SHARE_AUTH when not signed in", async () => {
    const fetchImpl = vi.fn();
    await expectMsgErr(
      listShareSessions({ getShareSettings: async () => emptyCfg, fetchImpl }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GETs /sessions with cookie + nonce and maps fields", async () => {
    const fetchImpl = vi.fn(async () => jsonRes([
      {
        session_id: "s1",
        kind: "FullPage",
        status: "Active",
        source_url: "https://news.test/x",
        prompt: "summarise",
        created_at: "2025-05-13T10:00:00Z",
        expires_at: "2025-05-14T10:00:00Z",
        urls: {
          html: "https://example.com/wp-json/inspect-page/v1/share/s1.SIG/index.html",
          css: "https://example.com/wp-json/inspect-page/v1/share/s1.SIG/style.css",
          js: "https://example.com/wp-json/inspect-page/v1/share/s1.SIG/script.js",
          image: "https://example.com/wp-json/inspect-page/v1/share/s1.SIG/preview.png",
        },
      },
    ]));
    const out = await listShareSessions({
      getShareSettings: async () => validCfg, fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/sessions");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["X-WP-Nonce"]).toBe("abc123");
    expect(out).toHaveLength(1);
    expect(out[0].sessionId).toBe("s1");
    expect(out[0].kind).toBe("FullPage");
    expect(out[0].urls.html).toContain("/share/s1.SIG/index.html");
  });

  it("falls back to empty url block when API omits urls", async () => {
    const fetchImpl = vi.fn(async () => jsonRes([{ session_id: "s2" }]));
    const out = await listShareSessions({
      getShareSettings: async () => validCfg, fetchImpl,
    });
    expect(out[0].urls).toEqual({ html: "", css: "", js: "", image: "" });
    expect(out[0].kind).toBe("");
  });

  it("throws E_SHARE_AUTH on 401/403", async () => {
    for (const status of [401, 403]) {
      const fetchImpl = vi.fn(async () => new Response(null, { status }));
      await expectMsgErr(
        listShareSessions({ getShareSettings: async () => validCfg, fetchImpl }),
        ErrorCode.E_SHARE_AUTH,
      );
    }
  });

  it("throws E_SHARE_UPSTREAM on 500", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));
    await expectMsgErr(
      listShareSessions({ getShareSettings: async () => validCfg, fetchImpl }),
      ErrorCode.E_SHARE_UPSTREAM,
    );
  });

  it("throws E_SHARE_NETWORK on fetch rejection", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("offline"); });
    await expectMsgErr(
      listShareSessions({ getShareSettings: async () => validCfg, fetchImpl }),
      ErrorCode.E_SHARE_NETWORK,
    );
  });

  it("normalizes trailing slash in siteUrl", async () => {
    const fetchImpl = vi.fn(async () => jsonRes([]));
    await listShareSessions({
      getShareSettings: async () => ({ ...validCfg, siteUrl: "https://example.com/" }),
      fetchImpl,
    });
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/sessions");
  });
});