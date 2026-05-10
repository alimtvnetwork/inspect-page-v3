/**
 * v2 — build the `prompt.md` shipped with MD+files / ZIP exports.
 * Source: spec/21-app/24-export-modes.md §D.
 *
 * Pure helper. No DOM, no fetch. Test-friendly.
 */
import { interpolateAi, type AiRefs } from "@shared/copy";
import type { ExportArtifacts } from "@shared/types";

export type PromptMode = "single" | "mdFiles" | "zip" | "share";

export interface BuildPromptOptions {
  mode: PromptMode;
  /** Required for `share` mode; ignored otherwise. */
  shareRefs?: AiRefs;
}

/** Choose the AI refs for a given mode + artifact set. */
export function refsForMode(
  artifacts: ExportArtifacts,
  opts: BuildPromptOptions,
): AiRefs {
  const primaryImage = artifacts.images[0];
  switch (opts.mode) {
    case "single":
      return {
        htmlRef: "(see §HTML below)",
        cssRef: "(see §CSS below)",
        imageRef: "(embedded inline)",
      };
    case "mdFiles":
    case "zip":
      return {
        htmlRef: "./index.html",
        cssRef: "./style.css",
        imageRef: primaryImage ? `./images/${primaryImage.name}` : "(no image)",
      };
    case "share": {
      if (!opts.shareRefs) {
        throw new Error("share mode requires shareRefs");
      }
      return opts.shareRefs;
    }
  }
}

/**
 * Build the contents of `prompt.md` for `mdFiles` / `zip` modes.
 * Returns just the AI instruction block — file lives next to the assets.
 */
export function buildPromptMd(
  artifacts: ExportArtifacts,
  opts: BuildPromptOptions,
): string {
  return interpolateAi(refsForMode(artifacts, opts));
}