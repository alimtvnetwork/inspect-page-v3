/**
 * All numeric and string constants used by the extension.
 * Source of truth: spec/21-app/20-performance-budgets.md.
 * Do NOT introduce magic numbers anywhere else.
 */

// ---- Timeouts (ms) ----
export const PING_TIMEOUT_MS = 1_000;
export const COLLECT_TIMEOUT_MS = 30_000;
export const SCROLL_STEP_TIMEOUT_MS = 5_000;
export const CAPTURE_TIMEOUT_MS = 3_000;
export const OFFSCREEN_FRAME_TIMEOUT_MS = 2_000;
export const STITCH_FINISH_TIMEOUT_MS = 15_000;
export const ISOLATED_LOAD_TIMEOUT_MS = 5_000;
export const ISOLATED_RENDER_TIMEOUT_MS = 10_000;
export const EXPORT_FULL_TIMEOUT_MS = 120_000;
export const EXPORT_ELEMENT_TIMEOUT_MS = 30_000;
export const KEEPALIVE_INTERVAL_MS = 25_000;

// ---- Throttles & settle ----
export const CAPTURE_GAP_MS = 600;
export const FRAME_SETTLE_MS = 50;
export const FRAME_SETTLE_RAFS = 2;
export const PICKER_THROTTLE_MS = 16;
export const STORAGE_WRITE_DEBOUNCE_MS = 250;
export const SUCCESS_AUTO_DISMISS_MS = 4_000;

// ---- Sizes & limits ----
export const STITCH_MAX_W_PX = 16_384;
export const STITCH_MAX_H_PX = 32_767;
export const STICKY_SCAN_LIMIT = 5_000;
export const SELECTOR_MAX_DEPTH = 12;
export const PICKER_TOOLTIP_MAX_CHARS = 80;
export const MD_IMAGE_MAX_BYTES = 2_097_152;
export const MD_FILE_MAX_BYTES = 10_485_760;
export const CAPTURE_RETRY_MAX = 1;
export const Z_INDEX_PICKER = 2_147_483_647;
export const Z_INDEX_PANEL = 2_147_483_646;

// ---- Format defaults ----
export const DEFAULT_IMAGE_FORMAT = "png" as const;
export const DEFAULT_JPEG_QUALITY = 90;
export const ZIP_COMPRESSION_LEVEL = 6;

// ---- Filenames ----
export const DEFAULT_NAME_FULLPAGE_TEMPLATE =
  "inspect-page-fullpage-{domain}-{timestamp}.zip";
export const DEFAULT_NAME_ELEMENT_TEMPLATE =
  "inspect-page-element-{domain}-{tag}-{timestamp}.md";
export const FILENAME_MAX_CHARS = 120;

// ---- Schema ----
export const CURRENT_SCHEMA_VERSION = 1 as const;
export const STORAGE_ROOT_KEY = "inspect-page";
export const STORAGE_SHARE_KEY = "inspect-page.share";

// ---- Logger ----
export const LOG_PREFIX = "[inspect-page]";

// ---- Static text ----
export const README_TXT =
  "This bundle was produced by the Inspect Page Chrome extension.\n" +
  "Feed the four files to your LLM together with your restyle prompt.\n" +
  "manifest.json contains capture metadata; screenshot.png is the full page.\n";

// ---- Smart Share backend (v2.2) ----
// The official Inspect Page WordPress backend. Baked into the extension so users
// never have to type a site URL. Leave empty until the production site is
// chosen; the Share Links export mode stays disabled while empty.
// TODO: set this to the production WordPress URL before publishing.
export const INSPECT_PAGE_WP_SITE_URL = "" as const;
