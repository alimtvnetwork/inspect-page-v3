/**
 * Service worker entry. Stage 2 — message router with Ping/GetSettings/SetSettings.
 */
import { LogCategory, MessageKind } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageRouter } from "@shared/messaging";
import { getSettings, setSettings } from "@shared/settings";
import type {
  GetSettingsPayload,
  GetSettingsResponse,
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

router.attach();
