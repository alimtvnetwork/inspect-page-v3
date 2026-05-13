import { describe, it, expect, vi } from "vitest";
import { createShareSession } from "../createShareSession";
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import type { CreateShareSessionPayload, ShareSettings } from "@shared/types";

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

const payload: CreateShareSessionPayload = {
  kind: "FullPage",
  sourceUrl: "https://news.ycombinator.com/",
  html: "<html></html>",
  css: "body{}",
  js: "console.log(1)",
  imageBase64: "AAAA",
  imageMime: "image/png",
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

async function expectMsgErr(p: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(MessageError);
  await p.catch((e) => expect((e as MessageError).code).toBe(code));
}

describe("createShareSession", () => {
  it("throws E_SHARE_AUTH when not signed in", async () => {
    const fetchImpl = vi.fn();
    await expectMsgErr(
      createShareSession(payload, { getShareSettings: async () => emptyCfg, fetchImpl }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts multipart with cookie + nonce, including js field", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({
        session_id: "abc",
        expires_at: "2099-01-01T00:00:00Z",
        urls: { html: "h", css: "c", js: "j", image: "i" },
      }),
    );
    const out = await createShareSession(payload, {
      getShareSettings: async () => validCfg,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toEqual({
      sessionId: "abc",
      expiresAt: "2099-01-01T00:00:00Z",
      urls: { html: "h", css: "c", js: "j", image: "i" },
    });
    const [calledUrl, init] = fetchImpl.mock.calls[0];
    expect(calledUrl).toBe("https://example.com/wp-json/inspect-page/v1/sessions");
    expect((init?.headers as Record<string, string>)["X-WP-Nonce"]).toBe("abc123");
    expect((init as RequestInit).credentials).toBe("include");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    const fd = init!.body as FormData;
    expect(fd.get("kind")).toBe("FullPage");
    expect(fd.get("source_url")).toBe("https://news.ycombinator.com/");
    expect((fd.get("image") as File).name).toBe("preview.png");
    expect((fd.get("js") as File).name).toBe("script.js");
  });

  it("uses .jpg suffix for image/jpeg", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ session_id: "x", expires_at: "z", urls: { html: "", css: "", js: "", image: "" } }),
    );
    await createShareSession(
      { ...payload, imageMime: "image/jpeg" },
      { getShareSettings: async () => validCfg, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    const fd = fetchImpl.mock.calls[0][1]!.body as FormData;
    expect((fd.get("image") as File).name).toBe("preview.jpg");
  });

  it("maps thrown fetch into E_SHARE_NETWORK", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_NETWORK,
    );
  });

  it("maps 401 into E_SHARE_AUTH and clears stale nonce", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));
    const setShareSettings = vi.fn(async (p) => ({ ...validCfg, ...p }));
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        setShareSettings: setShareSettings as never,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(setShareSettings).toHaveBeenCalledWith(expect.objectContaining({ nonce: "" }));
  });

  it("maps 429 into E_SHARE_QUOTA", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota", { status: 429 }));
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_QUOTA,
    );
  });

  it("maps 5xx into E_SHARE_UPSTREAM", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 502 }));
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_UPSTREAM,
    );
  });

  it("maps other 4xx into E_SHARE_BAD_INPUT", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing field", { status: 400 }));
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_BAD_INPUT,
    );
  });
});
