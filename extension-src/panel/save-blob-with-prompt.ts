/**
 * Helper: convert a blob to a data URL and hand it to the service worker
 * for a Chrome "Save As" dialog. Extracted from ExportPanel.tsx so both
 * the panel shell and the FullPageActions card can share it.
 */
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("FileReader failed"));
    fr.readAsDataURL(blob);
  });
}

export async function saveBlobWithPrompt(blob: Blob, filename: string): Promise<void> {
  const dataUrl = await blobToDataUrl(blob);
  await sendToBackground<
    { dataUrl: string; filename: string },
    { downloadId: number; savedPath?: string }
  >(MessageKind.DownloadBlob, { dataUrl, filename, saveAs: true });
}