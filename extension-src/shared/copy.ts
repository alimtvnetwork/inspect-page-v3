/**
 * Single source of truth for every visible string.
 * Source: spec/21-app/02-ui-panel.md §D.
 */
export const COPY = {
  appName: "PagePort",
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
  statusPicker: "Picker active. Click (or right-click) an element. Esc to cancel.",
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
  telemetryHeader: "Captured in this export",
  telemetryShadowRoots: "shadow roots",
  telemetryFonts: "fonts",
  telemetryIframesSame: "same-origin iframes",
  telemetryIframesCross: "cross-origin iframes (skipped)",
  telemetryStylesheets: "stylesheets",
  telemetryFrames: "screenshot tiles",
  telemetryElementOuterHtml: "outerHTML",
  telemetryElementMatchedRules: "matched CSS rules",
  telemetryElementComputedDiff: "computed-style diffs",
  telemetryElementScreenshots: "screenshots (context + isolated)",
  telemetryElementIsolatedSkipped: "isolated skipped",
  debugHeader: "Picked element",
  debugSelector: "Selector",
  debugTabHtml: "HTML",
  debugTabCss: "CSS",
  debugTabJs: "JS",
  debugCopy: "Copy",
  debugFormatLabel: "Format",
  debugFormatRaw: "Raw",
  debugFormatMd: "Markdown",
  debugDownloadCurrent: "Download current",
  debugDownloadAll: "Download all (zip)",
  debugClear: "Clear",
  debugJsEmpty: "Element-scoped JS is not extracted. Showing computed-style diff (JSON).",
  fullPageActionsHeader: "Re-download captured files",
  fullPageDownloadHtml: "HTML",
  fullPageDownloadCss: "CSS",
  fullPageDownloadJs: "JS",
  fullPageDownloadScreenshot: "Screenshot",
  fullPageDownloadAllZip: "Download all (zip)",
} as const;

export type CopyKey = keyof typeof COPY;

/**
 * Canonical AI instruction block embedded in every export mode.
 * Source: spec/21-app/24-export-modes.md §D.
 * Tokens: {{HTML_REF}}, {{CSS_REF}}, {{IMAGE_REF}}.
 */
export const AI_INSTRUCTION_BLOCK = `You are an expert front-end developer.
- HTML:  {{HTML_REF}}
- CSS:   {{CSS_REF}}
- Image: {{IMAGE_REF}}

Read all three. Understand the UI. Then follow the user's verbatim
instruction below and modify the CSS or HTML accordingly, including
animation. Output only the changed files.

--- USER INSTRUCTION ---
(write your instruction here)
`;

export interface AiRefs {
  htmlRef: string;
  cssRef: string;
  imageRef: string;
}

/** Replace {{HTML_REF}} / {{CSS_REF}} / {{IMAGE_REF}} placeholders. */
export function interpolateAi(refs: AiRefs): string {
  return AI_INSTRUCTION_BLOCK
    .replace("{{HTML_REF}}", refs.htmlRef)
    .replace("{{CSS_REF}}", refs.cssRef)
    .replace("{{IMAGE_REF}}", refs.imageRef);
}
