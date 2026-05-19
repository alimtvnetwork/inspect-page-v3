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
  MountFloatingPanelPayload,
  MountFloatingPanelResponse,
  GetSettingsResponse,
  PingPayload,
  PingResponse,
  RestoreAfterCapturePayload,
  RestoreAfterCaptureResponse,
  Settings,
} from "@shared/types";
import { collectArtifacts } from "@capture/collectArtifacts";
import { beginScrollCapture, restoreAfterCapture } from "@capture/scrollCapture";
import { describe, enterPicker, exitPicker } from "@picker/picker";
import type {
  EnterPickerModePayload, EnterPickerModeResponse,
  ExitPickerModePayload, ExitPickerModeResponse,
  StatusUpdatePayload,
} from "@shared/types";
import { collectElement } from "@element/collectElement";
import { collectElementSnapshot } from "@element/collectElementSnapshot";
import { collectSnapshot } from "./inspect/collectSnapshot";
import { locateColor } from "./inspect/locateColor";
import { mountFloatingPanel } from "@panel/mountFloatingPanel";

logger.debug(LogCategory.Lifecycle, "Content script loaded");

/**
 * Local in-page bus for StatusUpdate broadcasts.
 *
 * Why: chrome.runtime.sendMessage from a content script is delivered to the
 * extension (popup, SW, offscreen) but NOT back to listeners in the same
 * content-script context. The floating panel lives in this same context, so
 * runtime messages never reach it and the panel appears frozen — no debug
 * preview, no error surface. Mirroring the same payload as a window
 * CustomEvent lets the floating panel pick it up locally without affecting
 * the popup path.
 */
export const LPE_STATUS_EVENT = "inspect-page:status";
function dispatchStatusLocal(payload: StatusUpdatePayload): void {
  try {
    window.dispatchEvent(new CustomEvent(LPE_STATUS_EVENT, { detail: payload }));
  } catch { /* ignore */ }
}

const router = new MessageRouter();

router.on<PingPayload, PingResponse>(MessageKind.Ping, (payload) => {
  logger.debug(LogCategory.Messaging, `CS Ping rtt=${Date.now() - payload.sentAtMs}ms`);
  return { extensionVersion: __EXT_VERSION__, receivedAtMs: Date.now() };
});

router.on<MountFloatingPanelPayload, MountFloatingPanelResponse>(
  MessageKind.MountFloatingPanel,
  ({ tabId }) => {
    mountFloatingPanel({ tabId, activeUrl: location.href });
  },
);

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

// Inspect Mode (Phase A3): collect the page snapshot in the page context.
router.on<{ tabId: number }, { snapshot: unknown }>(
  MessageKind.CollectInspectSnapshot,
  () => ({ snapshot: collectSnapshot() }),
);

// Phase A8b: Locate — find DOM elements whose computed colors match `target`,
// scroll the first one into view, and flash a ring around every match.
router.on<{ target: string }, { count: number }>(
  MessageKind.LocateColor,
  ({ target }) => locateColor(target),
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
        dispatchStatusLocal({ status: PanelStatus.Selecting });
        void chrome.runtime.sendMessage({
          kind: MessageKind.StatusUpdate,
          requestId: `cs_selecting_${Date.now()}`,
          payload: { status: PanelStatus.Selecting } as StatusUpdatePayload,
        }).catch(() => undefined);
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
          const previewPayload: StatusUpdatePayload = {
            status: PanelStatus.Idle,
            message: payload.selectorPath,
            debugPreview: {
              selectorPath: payload.selectorPath,
              html: payload.outerHtml,
              css: payload.matchedCss,
              js: JSON.stringify(payload.computedDiff, null, 2),
            },
          };
          // C3 — also attach the rich element snapshot. Failures here must not
          // break the existing export flow, so wrap defensively.
          try {
            previewPayload.elementSnapshot = await collectElementSnapshot(element, {
              includeMatchedRules: settings.includeMatchedRules,
              includeComputedStyles: settings.includeComputedStyles,
            });
          } catch (e) {
            logger.warn(LogCategory.Element, "SNAPSHOT_FAIL", "element snapshot failed", e);
          }
          dispatchStatusLocal(previewPayload);
          // Step 2 (Pick-into-popup, Option A): persist the latest pick to
          // chrome.storage.session so the popup can hydrate it when the user
          // re-opens the toolbar icon after picking (popups close on focus
          // loss — a hard Chrome limitation).
          try {
            await chrome.storage.session.set({
              "inspect-page:last-pick": {
                ts: Date.now(),
                pageUrl: location.href,
                payload: previewPayload,
              },
            });
          } catch { /* session storage may be unavailable */ }
          try {
            await chrome.runtime.sendMessage({
              kind: MessageKind.StatusUpdate,
              requestId: `cs_dbg_${Date.now()}`,
              payload: previewPayload,
            });
          } catch { /* panel may be closed */ }
          // Do not auto-run the legacy element markdown download here. It can
          // remain in Selecting/Downloading while Chrome waits on saveAs,
          // locking both Export Full Page and Pick another element. The panel's
          // Pick view already exposes explicit export/download actions.
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
          dispatchStatusLocal(status);
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
          dispatchStatusLocal({ status: PanelStatus.Idle });
          void chrome.runtime.sendMessage({
            kind: MessageKind.StatusUpdate,
            requestId: `cs_cancel_${Date.now()}`,
            payload: { status: PanelStatus.Idle } as StatusUpdatePayload,
          }).catch(() => undefined);
      },
      onCommit: async (elements) => {
        logger.info(LogCategory.Picker, `Committed ${elements.length} elements`);
        exitPicker();
        try {
          const settings = await sendToBackground<Record<string, never>, GetSettingsResponse>(
            MessageKind.GetSettings, {},
          );
          const items: NonNullable<StatusUpdatePayload["multiElementSnapshot"]> = [];
          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            try {
              const payload = await collectElement(-1, el, rect, {
                redactPasswordFields: settings.redactPasswordFields,
                includeComputedStyles: settings.includeComputedStyles,
                includeMatchedRules: settings.includeMatchedRules,
              });
              const entry: (typeof items)[number] = {
                selectorPath: payload.selectorPath,
                debugPreview: {
                  selectorPath: payload.selectorPath,
                  html: payload.outerHtml,
                  css: payload.matchedCss,
                  js: JSON.stringify(payload.computedDiff, null, 2),
                },
                source: {
                  url: location.href,
                  capturedAtIso: new Date().toISOString(),
                  pageTitle: document.title || "",
                  viewport: { w: window.innerWidth, h: window.innerHeight },
                  dpr: window.devicePixelRatio || 1,
                },
              };
              try {
                entry.elementSnapshot = await collectElementSnapshot(el, {
                  includeMatchedRules: settings.includeMatchedRules,
                  includeComputedStyles: settings.includeComputedStyles,
                });
              } catch (e) {
                logger.warn(LogCategory.Element, "SNAPSHOT_FAIL", "multi snapshot failed", e);
              }
              items.push(entry);
            } catch (e) {
              logger.warn(LogCategory.Element, "COLLECT_FAIL", "multi collect failed", e);
            }
          }
          if (items.length === 0) {
            dispatchStatusLocal({ status: PanelStatus.Idle });
            return;
          }
          // Inspector focuses the last-clicked element by default.
          const last = items[items.length - 1];
          const previewPayload: StatusUpdatePayload = {
            status: PanelStatus.Selecting,
            message: last.selectorPath,
            debugPreview: last.debugPreview,
            elementSnapshot: last.elementSnapshot,
            multiElementSnapshot: items,
          };
          dispatchStatusLocal(previewPayload);
          try {
            await chrome.storage.session.set({
              "inspect-page:last-pick": {
                ts: Date.now(),
                pageUrl: location.href,
                payload: previewPayload,
              },
            });
          } catch { /* session storage may be unavailable */ }
          try {
            await chrome.runtime.sendMessage({
              kind: MessageKind.StatusUpdate,
              requestId: `cs_multi_${Date.now()}`,
              payload: previewPayload,
            });
          } catch { /* panel may be closed */ }
        } catch (e) {
          logger.error(LogCategory.Element, "MULTI_FAIL", "multi-element commit failed", e);
          const me = e instanceof MessageError ? e : null;
          const status: StatusUpdatePayload = {
            status: PanelStatus.Error,
            message: me?.message ?? (e instanceof Error ? e.message : String(e)),
            errorCode: me?.code ?? ErrorCode.E_PERMISSION_DENIED,
            errorDetail: me?.detail ?? (e instanceof Error ? e.stack : undefined),
          };
          dispatchStatusLocal(status);
          try {
            await chrome.runtime.sendMessage({
              kind: MessageKind.StatusUpdate,
              requestId: `cs_multi_err_${Date.now()}`,
              payload: status,
            });
          } catch { /* panel may be closed */ }
        }
      },
    });
  },
);

router.on<ExitPickerModePayload, ExitPickerModeResponse>(
  MessageKind.ExitPickerMode,
  () => { exitPicker(); },
);

router.attach();
