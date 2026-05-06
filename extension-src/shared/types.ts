/**
 * Cross-context types: settings, storage, export metadata, message envelopes.
 * Source: spec/21-app/15, /16, /17.
 */
import type { ErrorCode, MessageKind, PanelStatus } from "./enums";

// ---- Settings & storage ----
export type ImageFormat = "png" | "jpeg";

export interface Settings {
  imageFormat: ImageFormat;
  jpegQuality: number;
  namingTemplateFullPage: string;
  namingTemplateElement: string;
  redactPasswordFields: boolean;
  includeComputedStyles: boolean;
  includeMatchedRules: boolean;
  panelEnabledByDefault: boolean;
}

export interface PanelPosition {
  xPx: number;
  yPx: number;
  minimized: boolean;
}

export interface LastExportRecord {
  kind: "fullPage" | "element";
  filename: string;
  downloadId: number;
  finishedAtIso: string;
}

export interface StorageRoot {
  schemaVersion: 1;
  settings: Settings;
  panelPosition: PanelPosition;
  lastExport?: LastExportRecord;
}

// ---- Export metadata ----
export interface ExportMeta {
  schemaVersion: 1;
  kind: "fullPage";
  url: string;
  title: string;
  capturedAtIso: string;
  viewportCssPx: { w: number; h: number };
  pageCssPx: { w: number; h: number };
  devicePixelRatio: number;
  userAgent: string;
  counts: {
    inlineStyles: number;
    linkedStylesheets: number;
    unreachableStylesheets: number;
    inlineScripts: number;
    linkedScripts: number;
    unreachableScripts: number;
    captureFrames: number;
  };
  extensionVersion: string;
}

// ---- Geometry ----
export interface DomRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ---- Wire envelopes ----
export interface WireError {
  code: ErrorCode;
  message: string;
  detail?: string;
}

export type WireResponse<R> =
  | { ok: true; data: R }
  | { ok: false; error: WireError };

export interface Envelope<K extends MessageKind, P> {
  kind: K;
  requestId: string;
  payload: P;
}

// ---- Per-message payloads & responses ----
export interface PingPayload { sentAtMs: number }
export interface PingResponse { extensionVersion: string; receivedAtMs: number }

export interface RunFullPageExportPayload { tabId: number; settings: Settings }
export interface RunFullPageExportResponse { bundleFilename: string; downloadId: number }

export interface RunElementExportPayload {
  tabId: number;
  selectorPath: string;
  rect: DomRect;
  outerHtml: string;
  matchedCss: string;
  computedDiff: Record<string, string>;
  isolatedHtml: string;
  pageInfo: {
    url: string;
    title: string;
    viewportCssPx: { w: number; h: number };
    dpr: number;
  };
}
export interface RunElementExportResponse { mdFilename: string; downloadId: number }

export interface CollectPageArtifactsPayload { tabId: number }
export interface CollectPageArtifactsResponse {
  html: string;
  css: string;
  js: string;
  meta: ExportMeta;
}

export interface BeginScrollCapturePayload {
  y: number;
  viewportHeight: number;
  settleMs: number;
}
export interface BeginScrollCaptureResponse { actualY: number; dpr: number }

export interface RestoreAfterCapturePayload { requestId: string }
export type RestoreAfterCaptureResponse = void;

export interface CaptureViewportPayload {
  windowId: number;
  format: ImageFormat;
  quality?: number;
}
export interface CaptureViewportResponse { dataUrl: string }

export interface OffscreenAddFramePayload { dataUrl: string; xPx: number; yPx: number }
export interface OffscreenAddFrameResponse { framesPlaced: number }

export interface OffscreenStitchFinishPayload {
  format: ImageFormat;
  quality?: number;
}
export interface OffscreenStitchFinishResponse {
  blobUrl: string;
  widthPx: number;
  heightPx: number;
  bytes: number;
}

export interface OffscreenRenderIsolatedPayload {
  html: string;
  widthPx: number;
  heightPx: number;
}
export interface OffscreenRenderIsolatedResponse { dataUrl: string }

export interface StatusUpdatePayload {
  status: PanelStatus;
  message?: string;
  progress?: { done: number; total: number };
}
export type StatusUpdateResponse = void;

export type GetSettingsPayload = Record<string, never>;
export type GetSettingsResponse = Settings;

export type SetSettingsPayload = Partial<Settings>;
export type SetSettingsResponse = Settings;

export type GetPanelPositionPayload = Record<string, never>;
export type GetPanelPositionResponse = PanelPosition;

export type SetPanelPositionPayload = Partial<PanelPosition>;
export type SetPanelPositionResponse = PanelPosition;

export interface MountFloatingPanelPayload { tabId: number }
export type MountFloatingPanelResponse = void;

export interface EnterPickerModePayload { tabId: number }
export type EnterPickerModePayload_ = EnterPickerModePayload;
export type EnterPickerModeResponse = void;

export interface ExitPickerModePayload { tabId: number }
export type ExitPickerModeResponse = void;
