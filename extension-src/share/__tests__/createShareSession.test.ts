import { describe, it, expect, vi } from "vitest";
import { createShareSession } from "../createShareSession";
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import type { CreateShareSessionPayload, ShareSettings } from "@shared/types";

const validCfg: ShareSettings = {
  baseUrl: "https://example.com/",
  username: "alice",
  appPassword: "abcd efgh ijkl mnop",
};

const payload: CreateShareSessionPayload = {
  kind: "FullPage",
  sourceUrl: "https://news.ycombinator.com/",
  html: "<html></html>",
  css: "body{}",
  imageBase64: "AAAA",
  imageMime: "image/png",
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function expectMsgErr(p: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(MessageError);
  await p.catch((e) => expect((e as MessageError).code).toBe(code));
}

describe("createShareSession", () => {
  it("throws E_SHARE_AUTH when credentials missing", async () => {
    const fetchImpl = vi.fn();
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => ({ baseUrl: "", username: "", appPassword: "" }),
        fetchImpl,
      }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts multipart to /wp-json/pageport/v1/sessions with Basic auth + trimmed base URL", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonRes({
        session_id: "abc",
        expires_at: "2099-01-01T00:00:00Z",
        urls: { html: "h", css: "c", image: "i" },
      }),
    );
    const out = await createShareSession(payload, {
      getShareSettings: async () => validCfg,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(out).toEqual({
      sessionId: "abc",
      expiresAt: "2099-01-01T00:00:00Z",
      urls: { html: "h", css: "c", image: "i" },
    });
    const [calledUrl, init] = fetchImpl.mock.calls[0];
    expect(calledUrl).toBe("https://example.com/wp-json/pageport/v1/sessions");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Basic " + btoa("alice:abcd efgh ijkl mnop"),
    );
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    const fd = init!.body as FormData;
    expect(fd.get("kind")).toBe("FullPage");
    expect(fd.get("source_url")).toBe("https://news.ycombinator.com/");
    expect(fd.get("html")).toBeInstanceOf(Blob);
    expect((fd.get("image") as File).name).toBe("screenshot.png");
  });

  it("uses .jpg suffix for image/jpeg", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ session_id: "x", expires_at: "z", urls: { html: "", css: "", image: "" } }),
    );
    await createShareSession(
      { ...payload, imageMime: "image/jpeg" },
      { getShareSettings: async () => validCfg, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    const fd = fetchImpl.mock.calls[0][1]!.body as FormData;
    expect((fd.get("image") as File).name).toBe("screenshot.jpg");
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

  it("maps 401 into E_SHARE_AUTH", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_AUTH,
    );
  });

  it("maps 403 into E_SHARE_AUTH", async () => {
    const fetchImpl = vi.fn(async () => new Response("forbidden", { status: 403 }));
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_AUTH,
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
    const fetchImpl = vi.fn(async () =>
      new Response("missing field", { status: 400 }),
    );
    await expectMsgErr(
      createShareSession(payload, {
        getShareSettings: async () => validCfg,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
      ErrorCode.E_SHARE_BAD_INPUT,
    );
  });
});