/**
 * Service worker entry. Stage 2 — message router with Ping/GetSettings/SetSettings.
 */
import { ErrorCode, LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, MessageRouter, sendToTab } from "@shared/messaging";
import { getSettings, setSettings } from "@shared/settings";
import type {
  GetSettingsPayload,
  GetSettingsResponse,
  MountFloatingPanelPayload,
  MountFloatingPanelResponse,
  PingPayload,
  PingResponse,
  SetSettingsPayload,
  SetSettingsResponse,
} from "@shared/types";

logger.info(LogCategory.Lifecycle, `Service worker booted v${__EXT_VERSION__}`);

const router = new MessageRouter();

router.on<PingPayload, PingResponse>(MessageKind.Ping, (payload) => {
  logger.debug(LogCategory.Messaging, `Ping rtt=${Date.now() - payload.sentAtMs}ms`);
  return {
    extensionVersion: __EXT_VERSION__,
    receivedAtMs: Date.now(),
  };
});

router.on<GetSettingsPayload, GetSettingsResponse>(MessageKind.GetSettings, async () => {
  return getSettings();
});

router.on<SetSettingsPayload, SetSettingsResponse>(MessageKind.SetSettings, async (patch) => {
  return setSettings(patch);
});

router.on<MountFloatingPanelPayload, MountFloatingPanelResponse>(
  MessageKind.MountFloatingPanel,
  async ({ tabId }) => {
    try {
      // The CS is declared in manifest content_scripts so it should already
      // be alive on http(s) tabs. We forward; if the tab is a disabled URL
      // the send will reject and we surface E_NOT_AVAILABLE_HERE.
      await sendToTab<{ tabId: number }, void>(tabId, MessageKind.MountFloatingPanel, { tabId });
    } catch (e) {
      throw new MessageError(
        ErrorCode.E_NOT_AVAILABLE_HERE,
        "Cannot mount panel on this page",
        e instanceof Error ? e.message : String(e),
      );
    }
  },
);

router.attach();
