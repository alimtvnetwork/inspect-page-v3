import { describe, it, expect, vi } from "vitest";
import { revokeShareSession } from "../revokeShareSession";
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

function res(status: number): Response {
  return new Response(null, { status });
}

async function expectMsgErr(p: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(MessageError);
  await p.catch((e) => expect((e as MessageError).code).toBe(code));
}

describe("revokeShareSession", () => {
  it("throws E_SHARE_AUTH when not signed in", async () => {
    const fetchImpl = vi.fn();
    await expectMsgErr(
      revokeShareSession("sess_1", { getShareSettings: async () => emptyCfg, fetchImpl }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("DELETEs with cookie + nonce on 200", async () => {
    const fetchImpl = vi.fn(async () => res(200));
    await revokeShareSession("sess_42", {
      getShareSettings: async () => validCfg, fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/sessions/sess_42");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["X-WP-Nonce"]).toBe("abc123");
  });

  it("encodes session ids with unsafe chars", async () => {
    const fetchImpl = vi.fn(async () => res(204));
    await revokeShareSession("a/b c", {
      getShareSettings: async () => validCfg, fetchImpl,
    });
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/sessions/a%2Fb%20c");
  });

  it("treats 404 as success (idempotent)", async () => {
    const fetchImpl = vi.fn(async () => res(404));
    await expect(
      revokeShareSession("gone", { getShareSettings: async () => validCfg, fetchImpl }),
    ).resolves.toBeUndefined();
  });

  it("clears nonce + throws E_SHARE_AUTH on 401", async () => {
    const fetchImpl = vi.fn(async () => res(401));
    const setShareSettings = vi.fn(async () => validCfg);
    await expectMsgErr(
      revokeShareSession("s", {
        getShareSettings: async () => validCfg, setShareSettings, fetchImpl,
      }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(setShareSettings).toHaveBeenCalledWith({
      nonce: "", userId: 0, displayName: "", email: "", signedInAtIso: "",
    });
  });

  it("clears nonce + throws E_SHARE_AUTH on 403", async () => {
    const fetchImpl = vi.fn(async () => res(403));
    const setShareSettings = vi.fn(async () => validCfg);
    await expectMsgErr(
      revokeShareSession("s", {
        getShareSettings: async () => validCfg, setShareSettings, fetchImpl,
      }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(setShareSettings).toHaveBeenCalledOnce();
  });

  it("throws E_SHARE_UPSTREAM on 500", async () => {
    const fetchImpl = vi.fn(async () => res(500));
    await expectMsgErr(
      revokeShareSession("s", { getShareSettings: async () => validCfg, fetchImpl }),
      ErrorCode.E_SHARE_UPSTREAM,
    );
  });

  it("throws E_SHARE_NETWORK on fetch rejection", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("offline"); });
    await expectMsgErr(
      revokeShareSession("s", { getShareSettings: async () => validCfg, fetchImpl }),
      ErrorCode.E_SHARE_NETWORK,
    );
  });

  it("normalizes trailing slash in siteUrl", async () => {
    const fetchImpl = vi.fn(async () => res(200));
    await revokeShareSession("s1", {
      getShareSettings: async () => ({ ...validCfg, siteUrl: "https://example.com/" }),
      fetchImpl,
    });
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/sessions/s1");
  });
});