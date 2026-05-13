/**
 * Single source of truth for every visible string.
 * Source: spec/21-app/02-ui-panel.md §D.
 */
export const COPY = {
  appName: "Inspect Page",
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
  exportModesHeader: "Export for AI",
  exportModeMd: "MD",
  exportModeMdFiles: "MD + files",
  exportModeZip: "ZIP",
  exportModeShare: "Share Links",
  exportModeShareDisabledTip: "Sign in to Inspect Page in Settings → Smart Share",
  shareSettingsHeader: "Smart Share",
  shareHelp: "Sign in once with the Inspect Page account — no passwords or tokens are saved on your device.",
  shareNotConfiguredMsg: "Smart Share is being set up. This export mode will be available shortly.",
  shareSignInBtn: "Sign in",
  shareSignOutBtn: "Sign out",
  shareCheckBtn: "I'm signed in — refresh",
  shareSignedInAsPrefix: "Signed in as",
  shareSignedOutMsg: "Not signed in to this site.",
  shareBadUrlMsg: "Enter a valid http(s) site URL (e.g. https://example.com).",
  shareLoginOpenedMsg: "A WordPress login tab was opened. Sign in there, then come back and click \"refresh\".",
  shareUploading: "Uploading to WordPress…",
  shareCopied: "4 URLs + AI prompt copied to clipboard",
  shareExpiresInPrefix: "Expires in",
  shareDialogHeader: "Share links created",
  shareDialogIntro: "These 4 URLs are publicly fetchable for 24 hours. Anyone with a link can read the file.",
  shareLblHtml: "HTML",
  shareLblCss: "CSS",
  shareLblJs: "JS",
  shareLblImage: "Image",
  shareCopyOne: "Copy",
  shareCopyAll: "Copy AI prompt + 4 URLs",
  shareCopyAllDone: "Copied!",
  shareCopyOneDone: "Copied",
  shareRevokeBtn: "Revoke now",
  shareRevokedMsg: "Revoked. The links no longer work.",
  shareRevokingMsg: "Revoking…",
  shareCloseBtn: "Close",
  shareExpiredMsg: "Expired",
  shareQuotaPrefix: "Free shares used:",
  shareQuotaUnlimited: "Pro plan — unlimited shares",
  shareUpgradeHint: "Upgrade to Pro — coming soon",
  shareQuotaFreeReachedMsg: "Free quota reached. Upgrade to Inspect Page Pro to keep sharing (coming soon).",
} as const;

export type CopyKey = keyof typeof COPY;

/**
 * Canonical AI instruction block embedded in every export mode.
 * Source: spec/21-app/24-export-modes.md §D.
 * Tokens: {{HTML_REF}}, {{CSS_REF}}, {{JS_REF}}, {{IMAGE_REF}}.
 */
export const AI_INSTRUCTION_BLOCK = `I'm sharing a UI component with you. Please read all four files first, then apply the change I describe at the end.

HTML:    {{HTML_REF}}
CSS:     {{CSS_REF}}
JS:      {{JS_REF}}
Image:   {{IMAGE_REF}}

Instructions:
1. Fetch and read the HTML to understand the current markup and structure.
2. Fetch and read the CSS to understand the current styling, tokens, and breakpoints.
3. Fetch and read the JS to understand any current behavior.
4. Open the image to see how the component currently renders.
5. Then make the change requested below — modify HTML/CSS/JS only. Do not break the existing structure, semantics, or responsiveness unless I ask for it. You may add animations, restyle, or adjust layout.

My request:
<write your change request here>
`;

export interface AiRefs {
  htmlRef: string;
  cssRef: string;
  jsRef: string;
  imageRef: string;
}

/** Replace {{HTML_REF}} / {{CSS_REF}} / {{JS_REF}} / {{IMAGE_REF}} placeholders. */
export function interpolateAi(refs: AiRefs): string {
  return AI_INSTRUCTION_BLOCK
    .replace("{{HTML_REF}}", refs.htmlRef)
    .replace("{{CSS_REF}}", refs.cssRef)
    .replace("{{JS_REF}}", refs.jsRef)
    .replace("{{IMAGE_REF}}", refs.imageRef);
}
