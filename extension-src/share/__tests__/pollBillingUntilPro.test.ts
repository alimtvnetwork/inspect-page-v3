import { describe, it, expect, vi } from "vitest";
import { pollBillingUntilPro, BILLING_CHANGED_EVENT } from "../pollBillingUntilPro";
import type { ShareSettings } from "@shared/types";

const cfg: ShareSettings = {
  siteUrl: "https://example.com", userId: 1, displayName: "U",
  email: "u@x", nonce: "n", signedInAtIso: "",
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

describe("pollBillingUntilPro", () => {
  it("resolves and dispatches when plan flips to pro", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return jsonRes(calls < 3
        ? { has_license: false, plan: "free", configured: true, subscription: "",
            lifetime_used: 5, free_limit: 5, remaining: 0 }
        : { has_license: true, plan: "pro", configured: true, subscription: "sub_X",
            lifetime_used: 5, free_limit: 5, remaining: null });
    });
    const dispatched: string[] = [];
    const handle = pollBillingUntilPro({
      getShareSettings: async () => cfg,
      fetchImpl,
      intervalMs: 1,
      timeoutMs: 5000,
      dispatchImpl: (n) => dispatched.push(n),
    });
    const out = await handle.done;
    expect(out?.plan).toBe("pro");
    expect(dispatched).toContain(BILLING_CHANGED_EVENT);
    expect(calls).toBe(3);
  });

  it("resolves with last status on timeout", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      has_license: false, plan: "free", configured: true, subscription: "",
      lifetime_used: 0, free_limit: 5, remaining: 5,
    }));
    const dispatched: string[] = [];
    const handle = pollBillingUntilPro({
      getShareSettings: async () => cfg,
      fetchImpl,
      intervalMs: 5,
      timeoutMs: 25,
      dispatchImpl: (n) => dispatched.push(n),
    });
    const out = await handle.done;
    expect(out?.plan).toBe("free");
    expect(dispatched).toEqual([]);
  });

  it("cancel() stops polling", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      has_license: false, plan: "free", configured: true, subscription: "",
      lifetime_used: 0, free_limit: 5, remaining: 5,
    }));
    const handle = pollBillingUntilPro({
      getShareSettings: async () => cfg,
      fetchImpl,
      intervalMs: 5,
      timeoutMs: 10000,
    });
    setTimeout(() => handle.cancel(), 12);
    const out = await handle.done;
    expect(out === null || out.plan === "free").toBe(true);
  });
});
