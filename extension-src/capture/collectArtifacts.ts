/**
 * Aggregate collector — runs P1, P2, P3, P4 in order on the CS side.
 */
import type { CollectPageArtifactsResponse } from "@shared/types";
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { collectHtml } from "./collectHtml";
import { collectCss } from "./collectCss";
import { collectJs } from "./collectJs";
import { buildExportMeta } from "./buildExportMeta";

export interface CollectArtifactsOptions {
  redactPasswordFields: boolean;
  extensionVersion: string;
}

export async function collectArtifacts(
  opts: CollectArtifactsOptions,
): Promise<CollectPageArtifactsResponse> {
  const html = collectHtml({ redactPasswordFields: opts.redactPasswordFields });
  const { css, counts: cssCounts } = await collectCss();
  const { js, counts: jsCounts } = await collectJs();
  warnIfCustomElementsPresent();
  const meta = buildExportMeta({
    css: cssCounts,
    js: jsCounts,
    captureFrames: 0, // populated by SW after stitch.
    extensionVersion: opts.extensionVersion,
  });
  return { html, css, js, meta };
}

/**
 * Warn once per export when the page declares custom elements. Their
 * `outerHTML` is captured but their internal behavior (definitions in JS)
 * cannot be reproduced offline. Source: spec/21-app/19-edge-cases.md E13.
 */
function warnIfCustomElementsPresent(): void {
  try {
    const all = document.querySelectorAll<HTMLElement>("*");
    let count = 0;
    for (let i = 0; i < all.length; i += 1) {
      const tag = all[i].tagName;
      if (tag.includes("-")) { count += 1; if (count >= 1) break; }
    }
    if (count > 0) {
      logger.warn(
        LogCategory.HtmlSerialize, ErrorCode.W_WEB_COMPONENT_SKIPPED,
        "page uses custom elements; behavior not bundled (HTML preserved)",
      );
    }
  } catch {
    // Detection is best-effort; never block export.
  }
}
