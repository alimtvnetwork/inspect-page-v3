/**
 * P6 — Assemble ZIP. Source: spec/21-app/03 + 17.
 * Pure aside from JSZip; no chrome APIs.
 */
import JSZip from "jszip";
import { README_TXT, ZIP_COMPRESSION_LEVEL } from "@shared/constants";
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError } from "@shared/messaging";
import type { ExportMeta } from "@shared/types";

export interface BundleInput {
  html: string;
  css: string;
  js: string;
  pngBlob: Blob;
  meta: ExportMeta;
}

export async function buildBundle(input: BundleInput): Promise<Blob> {
  try {
    const zip = new JSZip();
    zip.file("page.html", input.html);
    zip.file("styles.css", input.css);
    zip.file("scripts.js", input.js);
    zip.file("screenshot.png", input.pngBlob);
    zip.file("manifest.json", `${JSON.stringify(input.meta, null, 2)}\n`);
    zip.file("README.txt", README_TXT);
    return await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: ZIP_COMPRESSION_LEVEL },
    });
  } catch (e) {
    logger.error(LogCategory.Zip, ErrorCode.E_ZIP_FAILED, "zip generate failed", e);
    throw new MessageError(ErrorCode.E_ZIP_FAILED, "Failed to build ZIP bundle");
  }
}
