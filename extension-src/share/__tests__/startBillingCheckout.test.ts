import { describe, it, expect, vi } from "vitest";
import { startBillingCheckout } from "../startBillingCheckout";
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

async function expectMsgErr(p: Promise<unknown>, code: ErrorCode): Promise<void> {
  await expect(p).rejects.toBeInstanceOf(MessageError);
  await p.catch((e) => expect((e as MessageError).code).toBe(code));
}

describe("startBillingCheckout", () => {
  it("throws E_SHARE_AUTH without nonce", async () => {
    const fetchImpl = vi.fn();
    await expectMsgErr(
      startBillingCheckout({ getShareSettings: async () => emptyCfg, fetchImpl }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs to /billing/checkout with cookie + nonce and returns url+id", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ url: "https://checkout.stripe.com/c/pay/cs_123", id: "cs_123" }),
    );
    const out = await startBillingCheckout({
      getShareSettings: async () => validCfg,
      fetchImpl,
      successUrl: "https://app/ok",
      cancelUrl: "https://app/cancel",
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/billing/checkout");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["X-WP-Nonce"]).toBe("abc123");
    expect(JSON.parse(String(init.body))).toEqual({
      success_url: "https://app/ok",
      cancel_url: "https://app/cancel",
    });
    expect(out).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_123", id: "cs_123" });
  });

  it("maps 401 to E_SHARE_AUTH", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ message: "no" }, 401));
    await expectMsgErr(
      startBillingCheckout({ getShareSettings: async () => validCfg, fetchImpl }),
      ErrorCode.E_SHARE_AUTH,
    );
  });

  it("surfaces upstream message on 502", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ message: "Stripe down" }, 502));
    const p = startBillingCheckout({ getShareSettings: async () => validCfg, fetchImpl });
    await expect(p).rejects.toBeInstanceOf(MessageError);
    await p.catch((e) => {
      expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_NETWORK);
      expect((e as MessageError).message).toBe("Stripe down");
    });
  });

  it("throws when response missing url", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ id: "cs_123" }));
    await expectMsgErr(
      startBillingCheckout({ getShareSettings: async () => validCfg, fetchImpl }),
      ErrorCode.E_SHARE_NETWORK,
    );
  });
});