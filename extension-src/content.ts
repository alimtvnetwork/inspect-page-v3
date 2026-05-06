/**
 * Content script entry. Stages 2/4/5/6 — message router for picker mount,
 * panel mount, artifact collection, and scroll-capture.
 */
import { LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageRouter, sendToBackground } from "@shared/messaging";
import type {
  BeginScrollCapturePayload,
  BeginScrollCaptureResponse,
  CollectPageArtifactsPayload,
  CollectPageArtifactsResponse,
  GetSettingsResponse,
  PingPayload,
  PingResponse,
  RestoreAfterCapturePayload,
  RestoreAfterCaptureResponse,
  Settings,
} from "@shared/types";
import { mountFloatingPanel } from "@panel/mountFloatingPanel";
import { collectArtifacts } from "@capture/collectArtifacts";
import { beginScrollCapture, restoreAfterCapture } from "@capture/scrollCapture";

logger.debug(LogCategory.Lifecycle, "Content script loaded");

const router = new MessageRouter();

router.on<PingPayload, PingResponse>(MessageKind.Ping, (payload) => {
  logger.debug(LogCategory.Messaging, `CS Ping rtt=${Date.now() - payload.sentAtMs}ms`);
  return { extensionVersion: __EXT_VERSION__, receivedAtMs: Date.now() };
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
        MessageKind.GetSettings, {},
      );
    } catch (e) {
      logger.warn(LogCategory.Settings, "GET_FAIL", "falling back to defaults", e);
      settings = { redactPasswordFields: true } as Settings;
    }
    return collectArtifacts({
      redactPasswordFields: settings.redactPasswordFields,
      extensionVersion: __EXT_VERSION__,
    });
  },
);

router.on<BeginScrollCapturePayload, BeginScrollCaptureResponse>(
  MessageKind.BeginScrollCapture,
  (payload) => beginScrollCapture(payload),
);

router.on<RestoreAfterCapturePayload, RestoreAfterCaptureResponse>(
  MessageKind.RestoreAfterCapture,
  () => { restoreAfterCapture(); },
);

router.attach();
