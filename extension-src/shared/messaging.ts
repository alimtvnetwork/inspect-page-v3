/**
 * Message envelope, dispatcher, and chrome.runtime bridge.
 * Source: spec/21-app/15-message-contracts.md.
 *
 * - Every message is wrapped in an Envelope { kind, requestId, payload }.
 * - Every response is a WireResponse<R> = { ok, data } | { ok, error }.
 * - Handlers throw WireError-shaped errors; dispatcher serializes them.
 */
import { ErrorCode, LogCategory, MessageKind } from "./enums";
import { logger } from "./logger";
import type { Envelope, WireError, WireResponse } from "./types";

export type Handler<P = unknown, R = unknown> = (
  payload: P,
  sender: chrome.runtime.MessageSender,
) => Promise<R> | R;

export class MessageError extends Error {
  constructor(public code: ErrorCode, message: string, public detail?: string) {
    super(message);
    this.name = "MessageError";
  }
  toWire(): WireError {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}

export function makeRequestId(): string {
  // Crypto-safe id; falls back to Math.random when unavailable (tests).
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeEnvelope<K extends MessageKind, P>(
  kind: K,
  payload: P,
  requestId: string = makeRequestId(),
): Envelope<K, P> {
  return { kind, requestId, payload };
}

export class MessageRouter {
  private handlers = new Map<MessageKind, Handler>();

  on<P, R>(kind: MessageKind, handler: Handler<P, R>): void {
    if (this.handlers.has(kind)) {
      logger.warn(LogCategory.Messaging, "ROUTER_DUP", `replacing handler ${kind}`);
    }
    this.handlers.set(kind, handler as Handler);
  }

  /**
   * chrome.runtime.onMessage listener. Returns true to keep sendResponse alive.
   */
  listener = (
    raw: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: WireResponse<unknown>) => void,
  ): boolean => {
    if (!isEnvelope(raw)) {
      // Not ours — let other listeners handle it.
      return false;
    }
    const env = raw;
    const handler = this.handlers.get(env.kind);
    if (!handler) {
      // Stay silent so other listeners in the extension (e.g. the SW
      // when this router runs in the offscreen document, or vice versa)
      // can answer. Returning false without calling sendResponse keeps
      // the channel open for the real handler.
      return false;
    }
    Promise.resolve()
      .then(() => handler(env.payload, sender))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) => {
        const wire = toWireError(err);
        logger.error(LogCategory.Messaging, wire.code, `${env.kind} failed`, err);
        sendResponse({ ok: false, error: wire });
      });
    return true;
  };

  attach(target: chrome.runtime.ExtensionMessageEvent = chrome.runtime.onMessage): void {
    target.addListener(this.listener as never);
  }
}

function isEnvelope(value: unknown): value is Envelope<MessageKind, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.kind === "string" &&
    typeof v.requestId === "string" &&
    "payload" in v &&
    Object.values(MessageKind).includes(v.kind as MessageKind)
  );
}

function toWireError(err: unknown): WireError {
  if (err instanceof MessageError) return err.toWire();
  const message = err instanceof Error ? err.message : String(err);
  return { code: ErrorCode.E_PERMISSION_DENIED, message };
}

// Re-export for non-chrome ExtensionMessageEvent type used above.
declare global {
  // chrome.runtime.ExtensionMessageEvent is the listener registry interface.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace chrome.runtime {
    interface ExtensionMessageEvent {
      addListener(cb: (...args: unknown[]) => unknown): void;
    }
  }
}

// ---- Client-side send helpers ----

export async function sendToBackground<P, R>(
  kind: MessageKind,
  payload: P,
): Promise<R> {
  const env = makeEnvelope(kind, payload);
  const res = (await chrome.runtime.sendMessage(env)) as WireResponse<R>;
  if (!res || res.ok !== true) {
    const e = res?.error ?? { code: ErrorCode.E_PERMISSION_DENIED, message: "no response" };
    throw new MessageError(e.code, e.message, e.detail);
  }
  return res.data;
}

export async function sendToTab<P, R>(
  tabId: number,
  kind: MessageKind,
  payload: P,
): Promise<R> {
  const env = makeEnvelope(kind, payload);
  let res: WireResponse<R>;
  try {
    res = (await chrome.tabs.sendMessage(tabId, env)) as WireResponse<R>;
  } catch (e) {
    // chrome.tabs.sendMessage rejects when the target frame is gone or the
    // content script is not reachable. Common Chromium phrases:
    //   "Could not establish connection. Receiving end does not exist."
    //   "The page failed to load."
    //   "The tab was closed."
    //   "Frame with ID 0 was removed."
    // Translate these into a single, user-actionable MessageError instead
    // of letting the raw string surface as a generic E_PERMISSION_DENIED.
    const msg = e instanceof Error ? e.message : String(e);
    if (/page failed to load|receiving end does not exist|could not establish connection|tab was closed|frame .* removed|the message port closed/i.test(msg)) {
      throw new MessageError(
        ErrorCode.E_NOT_AVAILABLE_HERE,
        "This page can't be exported right now. Reload the tab and try again, or open a different page.",
        msg,
      );
    }
    throw new MessageError(ErrorCode.E_NOT_AVAILABLE_HERE, msg, msg);
  }
  if (!res || res.ok !== true) {
    const e = res?.error ?? { code: ErrorCode.E_PERMISSION_DENIED, message: "no response" };
    throw new MessageError(e.code, e.message, e.detail);
  }
  return res.data;
}
