/**
 * Enums shared across all contexts.
 * Source: spec/21-app/15-message-contracts.md, 02-ui-panel.md, 09-error-handling.md.
 */

export enum MessageKind {
  Ping = "Ping",
  RunFullPageExport = "RunFullPageExport",
  RunElementExport = "RunElementExport",
  EnterPickerMode = "EnterPickerMode",
  ExitPickerMode = "ExitPickerMode",
  MountFloatingPanel = "MountFloatingPanel",
  CollectPageArtifacts = "CollectPageArtifacts",
  BeginScrollCapture = "BeginScrollCapture",
  RestoreAfterCapture = "RestoreAfterCapture",
  CaptureViewport = "CaptureViewport",
  OffscreenAddFrame = "OffscreenAddFrame",
  OffscreenStitchFinish = "OffscreenStitchFinish",
  OffscreenRenderIsolated = "OffscreenRenderIsolated",
  OffscreenInit = "OffscreenInit",
  OffscreenDispose = "OffscreenDispose",
  StatusUpdate = "StatusUpdate",
  GetSettings = "GetSettings",
  SetSettings = "SetSettings",
}

export enum PanelStatus {
  Idle = "Idle",
  Collecting = "Collecting",
  Capturing = "Capturing",
  Stitching = "Stitching",
  Bundling = "Bundling",
  Downloading = "Downloading",
  PickerActive = "PickerActive",
  Selecting = "Selecting",
  Success = "Success",
  Error = "Error",
}

export enum LogCategory {
  Capture = "Capture",
  CssCollect = "CssCollect",
  JsCollect = "JsCollect",
  HtmlSerialize = "HtmlSerialize",
  Picker = "Picker",
  Element = "Element",
  Stitch = "Stitch",
  Zip = "Zip",
  Download = "Download",
  Messaging = "Messaging",
  Offscreen = "Offscreen",
  Storage = "Storage",
  Settings = "Settings",
  Lifecycle = "Lifecycle",
}

export enum LogLevel {
  Debug = "Debug",
  Info = "Info",
  Warn = "Warn",
  Error = "Error",
}

export enum ErrorCode {
  E_HTML_SERIALIZE = "E_HTML_SERIALIZE",
  W_CSS_FETCH_FAILED = "W_CSS_FETCH_FAILED",
  W_CSS_INLINE_UNREADABLE = "W_CSS_INLINE_UNREADABLE",
  W_CSS_PARSE_FAILED = "W_CSS_PARSE_FAILED",
  W_JS_FETCH_FAILED = "W_JS_FETCH_FAILED",
  E_PAGE_TOO_LARGE = "E_PAGE_TOO_LARGE",
  E_CAPTURE_FAILED = "E_CAPTURE_FAILED",
  E_SCROLL_TIMEOUT = "E_SCROLL_TIMEOUT",
  E_STITCH_FAILED = "E_STITCH_FAILED",
  W_STICKY_SCAN_TRUNCATED = "W_STICKY_SCAN_TRUNCATED",
  W_ANIMATED_CONTENT = "W_ANIMATED_CONTENT",
  E_OFFSCREEN_BUSY = "E_OFFSCREEN_BUSY",
  E_ISOLATED_TIMEOUT = "E_ISOLATED_TIMEOUT",
  E_ISOLATED_FAILED = "E_ISOLATED_FAILED",
  E_ELEMENT_ZERO_SIZE = "E_ELEMENT_ZERO_SIZE",
  W_SELECTOR_INVALID = "W_SELECTOR_INVALID",
  W_AT_RULE_SKIPPED = "W_AT_RULE_SKIPPED",
  W_MD_TRUNCATED = "W_MD_TRUNCATED",
  E_ZIP_FAILED = "E_ZIP_FAILED",
  E_DOWNLOAD_FAILED = "E_DOWNLOAD_FAILED",
  E_COLLECT_TIMEOUT = "E_COLLECT_TIMEOUT",
  E_EXPORT_TIMEOUT = "E_EXPORT_TIMEOUT",
  E_STORAGE_PARSE = "E_STORAGE_PARSE",
  E_NOT_AVAILABLE_HERE = "E_NOT_AVAILABLE_HERE",
  E_PERMISSION_DENIED = "E_PERMISSION_DENIED",
  E_ROUTE_CHANGED = "E_ROUTE_CHANGED",
  E_PANEL_MOUNT_FAILED = "E_PANEL_MOUNT_FAILED",
  E_EXPORT_INTERRUPTED = "E_EXPORT_INTERRUPTED",
  W_IFRAME_NOT_TRAVERSED = "W_IFRAME_NOT_TRAVERSED",
  W_SHADOW_CLOSED = "W_SHADOW_CLOSED",
  W_SHADOW_OPEN_SKIPPED = "W_SHADOW_OPEN_SKIPPED",
  W_FONT_NOT_BUNDLED = "W_FONT_NOT_BUNDLED",
  W_WEB_COMPONENT_SKIPPED = "W_WEB_COMPONENT_SKIPPED",
  W_BLANK_PAGE_SUSPECTED = "W_BLANK_PAGE_SUSPECTED",
}
