import { describe, expect, it, vi } from "vitest";
import { ErrorCode, MessageKind } from "../enums";
import { MessageError, MessageRouter, makeEnvelope, makeRequestId } from "../messaging";
import type { WireResponse } from "../types";

function invoke(router: MessageRouter, msg: unknown): Promise<WireResponse<unknown>> {
  return new Promise((resolve) => {
    const sender = {} as chrome.runtime.MessageSender;
    const kept = router.listener(msg, sender, (r) => resolve(r));
    if (!kept) {
      // sync responses already resolved.
    }
  });
}

describe("MessageRouter", () => {
  it("dispatches a registered handler and wraps the result", async () => {
    const router = new MessageRouter();
    router.on(MessageKind.Ping, (p: { sentAtMs: number }) => ({
      extensionVersion: "1.2.3",
      receivedAtMs: p.sentAtMs + 1,
    }));
    const res = await invoke(router, makeEnvelope(MessageKind.Ping, { sentAtMs: 100 }));
    expect(res).toEqual({ ok: true, data: { extensionVersion: "1.2.3", receivedAtMs: 101 } });
  });

  it("returns E_NOT_AVAILABLE_HERE when no handler is registered", async () => {
    const router = new MessageRouter();
    const res = await invoke(router, makeEnvelope(MessageKind.GetSettings, {}));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe(ErrorCode.E_NOT_AVAILABLE_HERE);
  });

  it("rejects malformed envelopes", async () => {
    const router = new MessageRouter();
    const res = await invoke(router, { kind: "Bogus", requestId: "x", payload: {} });
    expect(res.ok).toBe(false);
  });

  it("serializes MessageError thrown by handler", async () => {
    const router = new MessageRouter();
    router.on(MessageKind.GetSettings, () => {
      throw new MessageError(ErrorCode.E_STORAGE_PARSE, "boom", "detail");
    });
    const res = await invoke(router, makeEnvelope(MessageKind.GetSettings, {}));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ErrorCode.E_STORAGE_PARSE);
      expect(res.error.detail).toBe("detail");
    }
  });

  it("serializes generic errors thrown by handler", async () => {
    const router = new MessageRouter();
    router.on(MessageKind.GetSettings, () => {
      throw new Error("nope");
    });
    const res = await invoke(router, makeEnvelope(MessageKind.GetSettings, {}));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toBe("nope");
  });

  it("makeRequestId produces unique non-empty strings", () => {
    const a = makeRequestId();
    const b = makeRequestId();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
