/**
 * Cross-context types: settings, storage, export metadata, message envelopes.
 * Source: spec/21-app/15, /16, /17.
 */
import type { ErrorCode, ExportFlow, MessageKind, PanelStatus } from "./enums";

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
  /** Persisted floating-panel size (Phase A12). Optional for backward compat. */
  wPx?: number;
  hPx?: number;
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
    fontsInlined?: number;
    fontsBytesInlined?: number;
    fontsFailed?: number;
    iframesTotal?: number;
    iframesSameOrigin?: number;
    iframesCrossOrigin?: number;
    iframesFailed?: number;
    /** v1.1: total open shadow roots expanded by the serializer. */
    shadowRootsExpanded?: number;
    /**
     * v1.1 element-export telemetry. These fields are only populated by
     * `runElementExport` and surfaced in the "Captured in this export"
     * panel block alongside the full-page counters.
     */
    elementOuterHtmlBytes?: number;
    elementMatchedRules?: number;
    elementComputedDiffEntries?: number;
    elementContextPngBytes?: number;
    elementIsolatedPngBytes?: number;
    elementIsolatedSkipped?: boolean;
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

export type GetPanelPositionPayload = Record<string, never>;
export type GetPanelPositionResponse = PanelPosition;

export type SetPanelPositionPayload = Partial<PanelPosition>;
export type SetPanelPositionResponse = PanelPosition;

export interface MountFloatingPanelPayload { tabId: number }
export type MountFloatingPanelResponse = void;

export interface OpenPopupWindowPayload { tabId?: number }
export type OpenPopupWindowResponse = void;

// ---- v2.2 Smart Share (WP plugin backend, cookie + nonce auth) ----
export interface ShareSettings {
  /** WP base URL the user typed (no trailing slash). */
  siteUrl: string;
  /** Latest known WP user id, or 0 when not signed in. */
  userId: number;
  /** Display name from /auth-status, or "". */
  displayName: string;
  /** Email from /auth-status, or "". */
  email: string;
  /** Latest fetched `wp_rest` nonce, or "". */
  nonce: string;
  /** ISO timestamp of last successful sign-in probe, or "". */
  signedInAtIso: string;
}

export type GetShareSettingsPayload = Record<string, never>;
export type GetShareSettingsResponse = ShareSettings;
export type SetShareSettingsPayload = Partial<ShareSettings>;
export type SetShareSettingsResponse = ShareSettings;

export interface CreateShareSessionPayload {
  /** "FullPage" | "Element" — sent verbatim to the WP plugin. */
  kind: string;
  sourceUrl: string;
  html: string;
  css: string;
  js: string;
  prompt?: string;
  /** PNG/JPEG bytes as base64 (no data: prefix). */
  imageBase64: string;
  imageMime: string;
}
export interface CreateShareSessionResponse {
  sessionId: string;
  expiresAt: string;
  urls: { html: string; css: string; js: string; image: string };
}

// ---- v2.2 sign-in probe ----
export type CheckShareAuthPayload = Record<string, never>;
export interface CheckShareAuthResponse {
  loggedIn: boolean;
  userId: number;
  displayName: string;
  email: string;
  nonce: string;
  quota?: {
    active: number; maxActive: number;
    hourlyUsed: number; maxHourly: number;
    lifetimeUsed: number;
    freeLimit: number;
    hasLicense: boolean;
  };
}

export interface OpenLoginPopupPayload { siteUrl: string }
export type OpenLoginPopupResponse = void;

export interface RevokeShareSessionPayload { sessionId: string }
export type RevokeShareSessionResponse = void;

export interface EnterPickerModePayload { tabId: number }
export type EnterPickerModePayload_ = EnterPickerModePayload;
export type EnterPickerModeResponse = void;

export interface ExitPickerModePayload { tabId: number }
export type ExitPickerModeResponse = void;

// ---- v2 export artifacts ----
/**
 * In-memory artifact bundle handed to the v2 export-mode toolbar.
 * Source: spec/21-app/24-export-modes.md.
 */
export interface ExportImage {
  /** Filename used inside MD+files / ZIP exports (e.g. "screenshot.png"). */
  name: string;
  /** MIME type, e.g. "image/png". */
  mime: string;
  /** Base64-encoded image data, no data: prefix. */
  base64: string;
}

export interface ExportArtifacts {
  flow: ExportFlow;
  /** Site domain for filename templating. */
  domain: string;
  html: string;
  css: string;
  js: string;
  images: ExportImage[];
  meta: ExportMeta;
}

/* ---------- Inspect Mode (Phase A3+) ---------- */
export interface CollectInspectSnapshotPayload { tabId: number }
export interface CollectInspectSnapshotResponse {
  /** {@link import("../inspect/types").InspectSnapshot} — kept loose to avoid a cross-package cycle. */
  snapshot: unknown;
  /** PNG data URL of the visible viewport. */
  thumbnailDataUrl: string;
}
