/**
 * panelActions — typed wrappers around `sendToBackground` for every
 * background-bound action the ExportPanel triggers. Pulling these out of
 * ExportPanel.tsx (B2) keeps the component focused on rendering + state,
 * and gives each action a single named signature instead of inline generics.
 */
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type {
  Settings,
  ShareSettings,
  ExportMeta,
  ExportArtifacts,
  CreateShareSessionResponse,
} from "@shared/types";

export interface FullPageExportResponse {
  bundleFilename: string;
  downloadId: number;
  telemetry?: ExportMeta["counts"];
  artifacts?: {
    html: string;
    css: string;
    js: string;
    screenshotDataUrl: string;
    meta: ExportMeta;
  };
}

export function requestFullPageExport(tabId: number, settings: Settings): Promise<FullPageExportResponse> {
  return sendToBackground<{ tabId: number; settings: Settings }, FullPageExportResponse>(
    MessageKind.RunFullPageExport, { tabId, settings },
  );
}

export function requestEnterPicker(tabId: number): Promise<void> {
  return sendToBackground<{ tabId: number }, void>(MessageKind.EnterPickerMode, { tabId });
}

export function requestExitPicker(tabId: number): Promise<void> {
  return sendToBackground<{ tabId: number }, void>(MessageKind.ExitPickerMode, { tabId });
}

export function requestCancelFullPage(tabId: number): Promise<void> {
  return sendToBackground<{ tabId: number }, void>(MessageKind.CancelFullPageExport, { tabId });
}

export function requestSettingsPatch(patch: Partial<Settings>): Promise<Settings> {
  return sendToBackground<Partial<Settings>, Settings>(MessageKind.SetSettings, patch);
}

export function requestShareSettingsPatch(patch: Partial<ShareSettings>): Promise<ShareSettings> {
  return sendToBackground<Partial<ShareSettings>, ShareSettings>(MessageKind.SetShareSettings, patch);
}

export function requestCreateShareSession(
  artifacts: ExportArtifacts,
  sourceUrl: string,
): Promise<CreateShareSessionResponse> {
  const primary = artifacts.images[0];
  if (!primary) {
    throw new Error("No image to upload — Share Links requires a screenshot.");
  }
  return sendToBackground<
    {
      kind: string; sourceUrl: string;
      html: string; css: string; js: string;
      imageBase64: string; imageMime: string;
    },
    CreateShareSessionResponse
  >(MessageKind.CreateShareSession, {
    kind: artifacts.flow,
    sourceUrl,
    html: artifacts.html,
    css: artifacts.css,
    js: artifacts.js,
    imageBase64: primary.base64,
    imageMime: primary.mime,
  });
}