import { describe, it, expect, vi } from "vitest";
import { getBillingStatus } from "../get-billing-status";
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

describe("getBillingStatus", () => {
  it("throws E_SHARE_AUTH without nonce", async () => {
    const fetchImpl = vi.fn();
    const p = getBillingStatus({ getShareSettings: async () => emptyCfg, fetchImpl });
    await expect(p).rejects.toBeInstanceOf(MessageError);
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_AUTH));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GETs /billing/status with cookie+nonce and parses free plan", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      has_license: false,
      plan: "free",
      configured: true,
      subscription: "",
      lifetime_used: 2,
      free_limit: 5,
      remaining: 3,
    }));
    const out = await getBillingStatus({ getShareSettings: async () => validCfg, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/billing/status");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["X-WP-Nonce"]).toBe("abc123");
    expect(out).toEqual({
      hasLicense: false, plan: "free", configured: true, subscription: "",
      lifetimeUsed: 2, freeLimit: 5, remaining: 3,
    });
  });

  it("returns remaining=null when on Pro plan", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      has_license: true, plan: "pro", configured: true,
      subscription: "sub_123", lifetime_used: 42, free_limit: 5, remaining: null,
    }));
    const out = await getBillingStatus({ getShareSettings: async () => validCfg, fetchImpl });
    expect(out.hasLicense).toBe(true);
    expect(out.plan).toBe("pro");
    expect(out.remaining).toBeNull();
    expect(out.subscription).toBe("sub_123");
  });

  it("maps 401 to E_SHARE_AUTH", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ message: "nope" }, 401));
    const p = getBillingStatus({ getShareSettings: async () => validCfg, fetchImpl });
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_AUTH));
  });

  it("maps 5xx to E_SHARE_NETWORK", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({}, 500));
    const p = getBillingStatus({ getShareSettings: async () => validCfg, fetchImpl });
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_NETWORK));
  });
});
