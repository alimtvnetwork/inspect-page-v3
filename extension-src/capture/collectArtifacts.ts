/**
 * Aggregate collector — runs P1, P2, P3, P4 in order on the CS side.
 */
import type { CollectPageArtifactsResponse } from "@shared/types";
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
  const meta = buildExportMeta({
    css: cssCounts,
    js: jsCounts,
    captureFrames: 0, // populated by SW after stitch.
    extensionVersion: opts.extensionVersion,
  });
  return { html, css, js, meta };
}
