/**
 * Content script entry. Stage 2 — Ping handler so the SW can verify presence.
 */
import { LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageRouter } from "@shared/messaging";
import type { PingPayload, PingResponse } from "@shared/types";
import { mountFloatingPanel } from "@panel/mountFloatingPanel";

logger.debug(LogCategory.Lifecycle, "Content script loaded");

const router = new MessageRouter();

router.on<PingPayload, PingResponse>(MessageKind.Ping, (payload) => {
  logger.debug(LogCategory.Messaging, `CS Ping rtt=${Date.now() - payload.sentAtMs}ms`);
  return {
    extensionVersion: __EXT_VERSION__,
    receivedAtMs: Date.now(),
  };
});

router.on<{ tabId: number }, void>(MessageKind.MountFloatingPanel, () => {
  mountFloatingPanel();
});

router.attach();
