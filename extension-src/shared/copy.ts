/**
 * Single source of truth for every visible string.
 * Source: spec/21-app/02-ui-panel.md §D.
 */
export const COPY = {
  appName: "LLM Page Export",
  btnFullPage: "Export Full Page",
  btnPick: "Pick Element",
  btnCancel: "Cancel",
  btnCancelPicker: "Cancel picker",
  btnRetry: "Retry",
  btnCopyDetails: "Copy details",
  btnResetSettings: "Reset to defaults",
  btnOpenPanel: "Open panel on page",
  btnMinimize: "Minimize",
  btnClose: "Close",
  statusIdle: "Idle",
  statusCollecting: "Collecting page assets…",
  statusCapturing: "Capturing screenshot {done}/{total}",
  statusStitching: "Stitching image…",
  statusBundling: "Building ZIP…",
  statusDownloading: "Downloading…",
  statusPicker: "Picker active. Right-click an element. Esc to cancel.",
  statusSelecting: "Building element export…",
  statusSuccess: "Saved {filename}",
  statusError: "Error: {message} ({code})",
  settingsHeader: "Settings",
  lblImageFormat: "Image format",
  lblJpegQuality: "JPEG quality",
  lblRedact: "Redact <input type=password> values",
  lblComputed: "Include computed styles",
  lblMatched: "Include matched rules",
  lblNameFull: "Filename — full page",
  lblNameElem: "Filename — element",
  notAvailable: "Not available on browser pages.",
} as const;

export type CopyKey = keyof typeof COPY;
