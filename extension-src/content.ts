/**
 * Content script entry. Stages 2/4/5/6 — message router for picker mount,
 * panel mount, artifact collection, and scroll-capture.
 */
import { ErrorCode, LogCategory, MessageKind, PanelStatus } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError, MessageRouter, sendToBackground } from "@shared/messaging";
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
import { describe, enterPicker, exitPicker } from "@picker/picker";
import type {
  EnterPickerModePayload, EnterPickerModeResponse,
  ExitPickerModePayload, ExitPickerModeResponse,
  RunElementExportResponse,
  StatusUpdatePayload,
} from "@shared/types";
import { collectElement } from "@element/collectElement";

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

router.on<EnterPickerModePayload, EnterPickerModeResponse>(
  MessageKind.EnterPickerMode,
  () => {
    enterPicker({
      onSelect: async ({ element, rect }) => {
        logger.info(LogCategory.Picker, `Picked ${describe(element)}`);
        exitPicker();
        try {
          const settings = await sendToBackground<Record<string, never>, GetSettingsResponse>(
            MessageKind.GetSettings, {},
          );
          // tabId is unknown from CS; SW resolves via sender.tab.id.
          const payload = await collectElement(-1, element, rect, {
            redactPasswordFields: settings.redactPasswordFields,
            includeComputedStyles: settings.includeComputedStyles,
            includeMatchedRules: settings.includeMatchedRules,
          });
          // v1.2: stream the extracted artifacts into the panel for in-app
          // debugging *before* attempting the download. This way the user
          // always sees HTML/CSS/JS even if the bundle build/save fails.
          try {
            await chrome.runtime.sendMessage({
              kind: MessageKind.StatusUpdate,
              requestId: `cs_dbg_${Date.now()}`,
              payload: {
                status: PanelStatus.Selecting,
                message: payload.selectorPath,
                debugPreview: {
                  selectorPath: payload.selectorPath,
                  html: payload.outerHtml,
                  css: payload.matchedCss,
                  js: JSON.stringify(payload.computedDiff, null, 2),
                },
              } as StatusUpdatePayload,
            });
          } catch { /* panel may be closed */ }
          await sendToBackground<typeof payload, RunElementExportResponse>(
            MessageKind.RunElementExport, payload,
          );
        } catch (e) {
          logger.error(LogCategory.Element, "EXPORT_FAIL", "element export failed", e);
          const me = e instanceof MessageError ? e : null;
          const message = me?.message ?? (e instanceof Error ? e.message : String(e));
          const detail = me?.detail ?? (e instanceof Error ? e.stack : undefined);
          const code = me?.code ?? ErrorCode.E_PERMISSION_DENIED;
          // Surface the failure in the panel — otherwise it stays stuck in
          // "PickerActive" forever and the user sees "nothing happens".
          const status: StatusUpdatePayload = {
            status: PanelStatus.Error,
            message,
            errorCode: code,
            errorDetail: detail,
          };
          try {
            await chrome.runtime.sendMessage({
              kind: MessageKind.StatusUpdate,
              requestId: `cs_err_${Date.now()}`,
              payload: status,
            });
          } catch { /* panel may be closed */ }
        }
      },
      onCancel: () => {
        logger.info(LogCategory.Picker, "Picker cancelled");
          void chrome.runtime.sendMessage({
            kind: MessageKind.StatusUpdate,
            requestId: `cs_cancel_${Date.now()}`,
            payload: { status: PanelStatus.Idle } as StatusUpdatePayload,
          }).catch(() => undefined);
      },
    });
  },
);

router.on<ExitPickerModePayload, ExitPickerModeResponse>(
  MessageKind.ExitPickerMode,
  () => { exitPicker(); },
);

router.attach();
