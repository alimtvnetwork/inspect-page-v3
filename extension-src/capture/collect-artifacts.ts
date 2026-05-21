/**
 * Aggregate collector — runs P1, P2, P3, P4 in order on the CS side.
 */
import type { CollectPageArtifactsResponse } from "@shared/types";
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { collectHtml } from "./collect-html";
import { collectCss } from "./collect-css";
import { collectJs } from "./collect-js";
import { buildExportMeta } from "./build-export-meta";
import { collectInjectedOverlays } from "../inspect/overlay-filter";

export interface CollectArtifactsOptions {
  redactPasswordFields: boolean;
  extensionVersion: string;
}

export async function collectArtifacts(
  opts: CollectArtifactsOptions,
): Promise<CollectPageArtifactsResponse> {
  // Temporarily detach foreign-extension overlay nodes (and Inspect Page's
  // own hosts) so they don't end up in the exported HTML. Re-attach in
  // finally regardless of success.
  const detached: Array<{ node: HTMLElement; parent: Node; next: Node | null }> = [];
  try {
    for (const node of collectInjectedOverlays(document, window)) {
      const parent = node.parentNode;
      if (!parent) continue;
      detached.push({ node, parent, next: node.nextSibling });
      parent.removeChild(node);
    }
  } catch { /* best-effort */ }

  let html: string;
  let css: Awaited<ReturnType<typeof collectCss>>;
  let js: Awaited<ReturnType<typeof collectJs>>;
  try {
    html = collectHtml({ redactPasswordFields: opts.redactPasswordFields });
    css = await collectCss();
    js = await collectJs();
    warnIfCustomElementsPresent();
  } finally {
    for (const d of detached) {
      try { d.parent.insertBefore(d.node, d.next); } catch { /* ignore */ }
    }
  }
  const cssCounts = css.counts;
  const jsCounts = js.counts;
  const meta = buildExportMeta({
    css: cssCounts,
    js: jsCounts,
    captureFrames: 0, // populated by SW after stitch.
    extensionVersion: opts.extensionVersion,
  });
  return { html, css: css.css, js: js.js, meta };
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
