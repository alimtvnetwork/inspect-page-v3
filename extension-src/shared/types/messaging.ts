/**
 * Wire envelopes and per-message payload/response types.
 * Split from shared/types.ts (S2).
 */
import type { ErrorCode, MessageKind, PanelStatus } from "../enums";
import type { ImageFormat, PanelPosition, Settings } from "./settings";
import type { DomRect, ExportMeta } from "./export";

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

export interface RunFullPageExportPayload {
  tabId: number;
  settings: Settings;
  /** When true, collect/capture artifacts but do not auto-save the default ZIP. */
  captureOnly?: boolean;
}
export interface RunFullPageExportResponse {
  bundleFilename: string;
  downloadId: number;
  /**
   * Compact subset of `ExportMeta.counts` returned to the panel so it can
   * surface "what was captured" telemetry to the user without needing to
   * unzip the bundle. Optional — older background builds may omit it.
   */
  telemetry?: ExportMeta["counts"];
  /**
   * v1.3: in-memory copy of the captured artifacts, returned to the panel
   * so it can offer atomic per-file / Markdown / zip re-downloads after
   * the default bundle has been written to disk. Optional — only present
   * when capture succeeded.
   */
  artifacts?: {
    html: string;
    css: string;
    js: string;
    screenshotDataUrl: string;
    meta: ExportMeta;
  };
}

export interface CancelFullPageExportPayload { tabId: number }
export type CancelFullPageExportResponse = void;

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

export interface MountFloatingPanelPayload { tabId: number }
export type MountFloatingPanelResponse = void;

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
  /**
   * v1.1: optional telemetry attached to a terminal Success update so the
   * panel can render the "Captured in this export" block for flows whose
   * top-level message has no return value to the panel (e.g. element
   * export, which is initiated from CS via the picker).
   */
  telemetry?: ExportMeta["counts"];
  /**
   * Optional error metadata attached to terminal Error broadcasts so the
   * panel can render `[code] message` and surface a copyable detail blob.
   * Used by the content-script picker path which has no top-level reply to
   * the panel (errors there would otherwise vanish into console.error).
   */
  errorCode?: ErrorCode;
  errorDetail?: string;
  /**
   * v1.2: debug preview for the element picker. When present, the panel
   * renders an in-panel HTML / CSS / JS inspector so the user can see what
   * was extracted without unzipping the bundle. Populated by the content
   * script immediately after `collectElement` succeeds, regardless of
   * whether the downstream export later fails.
   */
  debugPreview?: {
    selectorPath: string;
    html: string;
    css: string;
    js: string;
  };
  /**
   * C3 — rich element snapshot for the new Pick Element Inspector view.
   * Typed as unknown here to avoid a shared→element import cycle; the panel
   * casts to `ElementSnapshot` at the use site.
   */
  elementSnapshot?: unknown;
  /**
   * v2.7.2 — multi-element picker. Populated when the user commits more than
   * one element from the picker via the Done button. Order matches click
   * order. The single-element `debugPreview` / `elementSnapshot` fields
   * still reflect the *last-clicked* element so the inspector body shows
   * that pick by default; the panel renders a chip strip from this list.
   */
  multiElementSnapshot?: {
    selectorPath: string;
    debugPreview: {
      selectorPath: string;
      html: string;
      css: string;
      js: string;
    };
    elementSnapshot?: unknown;
    /**
     * v2.7.2 — per-element source metadata so the combined MD export can
     * render a `## Source — Element N` block for every selected element.
     */
    source?: {
      url: string;
      capturedAtIso: string;
      pageTitle: string;
      viewport: { w: number; h: number };
      dpr: number;
    };
  }[];
  /**
   * Full-page artifacts may be attached to the terminal Success broadcast so
   * floating panels receive the rich post-export actions before the top-level
   * background response returns.
   */
  fullPageArtifacts?: RunFullPageExportResponse["artifacts"];
}
export type StatusUpdateResponse = void;

export type GetSettingsPayload = Record<string, never>;
export type GetSettingsResponse = Settings;

export type SetSettingsPayload = Partial<Settings>;
export type SetSettingsResponse = Settings;

export interface GetTabZoomPayload { tabId: number }
export interface GetTabZoomResponse { zoomFactor: number }

export type GetPanelPositionPayload = Record<string, never>;
export type GetPanelPositionResponse = PanelPosition;

export type SetPanelPositionPayload = Partial<PanelPosition>;
export type SetPanelPositionResponse = PanelPosition;

export interface EnterPickerModePayload { tabId: number }
export type EnterPickerModePayload_ = EnterPickerModePayload;
export type EnterPickerModeResponse = void;

export interface ExitPickerModePayload { tabId: number }
export type ExitPickerModeResponse = void;

/* ---------- Inspect Mode (Phase A3+) ---------- */
export interface CollectInspectSnapshotPayload { tabId: number }
export interface CollectInspectSnapshotResponse {
  /** {@link import("../../inspect/types").InspectSnapshot} — kept loose to avoid a cross-package cycle. */
  snapshot: unknown;
  /** PNG data URL of the visible viewport. */
  thumbnailDataUrl: string;
}

export interface DownloadBlobPayload { dataUrl: string; filename: string; saveAs?: boolean }
export interface DownloadBlobResponse { downloadId: number; savedPath?: string }