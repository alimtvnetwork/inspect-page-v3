import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { DownloadBlobPayload, DownloadBlobResponse } from "@shared/types";

/**
 * Phase A11 — text download helper for Inspect Mode exports.
 *
 * The floating panel runs inside an in-page iframe, where synthetic
 * `<a download>` clicks can be ignored by Chrome. Route the primary path
 * through the extension downloads API so each export opens Chrome's
 * Save As picker. Keep the anchor path as a last-resort fallback.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}

function anchorDownload(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadText(text: string, filename: string, mime: string): Promise<void> {
  try {
    const dataUrl = await blobToDataUrl(new Blob([text], { type: mime }));
    await sendToBackground<DownloadBlobPayload, DownloadBlobResponse>(
      MessageKind.DownloadBlob, { dataUrl, filename, saveAs: true },
    );
  } catch {
    anchorDownload(text, filename, mime);
  }
}