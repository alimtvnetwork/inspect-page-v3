import { describe, it, expect, vi } from "vitest";
import { startBillingPortal } from "../startBillingPortal";
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

describe("startBillingPortal", () => {
  it("throws E_SHARE_AUTH without nonce", async () => {
    const fetchImpl = vi.fn();
    await expectMsgErr(
      startBillingPortal({ getShareSettings: async () => emptyCfg, fetchImpl }),
      ErrorCode.E_SHARE_AUTH,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs /billing/portal with cookie+nonce and returns url", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ url: "https://billing.stripe.com/p/session/abc" }),
    );
    const out = await startBillingPortal({
      getShareSettings: async () => validCfg,
      fetchImpl,
      returnUrl: "https://app/back",
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/wp-json/inspect-page/v1/billing/portal");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["X-WP-Nonce"]).toBe("abc123");
    expect(JSON.parse(String(init.body))).toEqual({ return_url: "https://app/back" });
    expect(out).toEqual({ url: "https://billing.stripe.com/p/session/abc" });
  });

  it("maps 404 (no customer yet) to E_SHARE_NETWORK with upstream message", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonRes({ message: "No Stripe customer for this user yet." }, 404),
    );
    const p = startBillingPortal({ getShareSettings: async () => validCfg, fetchImpl });
    await expect(p).rejects.toBeInstanceOf(MessageError);
    await p.catch((e) => {
      expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_NETWORK);
      expect((e as MessageError).message).toContain("No Stripe customer");
    });
  });

  it("throws when response missing url", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({}));
    await expectMsgErr(
      startBillingPortal({ getShareSettings: async () => validCfg, fetchImpl }),
      ErrorCode.E_SHARE_NETWORK,
    );
  });
});