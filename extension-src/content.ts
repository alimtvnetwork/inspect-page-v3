/**
 * Content script entry. Stage 2 — Ping handler so the SW can verify presence.
 */
import { LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageRouter } from "@shared/messaging";
import type {
  CollectPageArtifactsPayload,
  CollectPageArtifactsResponse,
  PingPayload,
  PingResponse,
  Settings,
} from "@shared/types";
import { mountFloatingPanel } from "@panel/mountFloatingPanel";
import { collectArtifacts } from "@capture/collectArtifacts";
import { sendToBackground } from "@shared/messaging";
import type { GetSettingsResponse } from "@shared/types";

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

router.on<CollectPageArtifactsPayload, CollectPageArtifactsResponse>(
  MessageKind.CollectPageArtifacts,
  async () => {
    let settings: Settings;
    try {
      settings = await sendToBackground<Record<string, never>, GetSettingsResponse>(
        MessageKind.GetSettings,
        {},
      );
    } catch (e) {
      logger.warn(LogCategory.Settings, "GET_FAIL", "falling back to defaults", e);
      // Fall back to a strict default — we never want to leak passwords.
      settings = { redactPasswordFields: true } as Settings;
    }
    return collectArtifacts({
      redactPasswordFields: settings.redactPasswordFields,
      extensionVersion: __EXT_VERSION__,
    });
  },
);

router.attach();
