/**
 * Helper: convert a blob to a data URL and hand it to the service worker
 * for a Chrome "Save As" dialog. Extracted from ExportPanel.tsx so both
 * the panel shell and the FullPageActions card can share it.
 */
export async function saveBlobWithPrompt(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  (document.body ?? document.documentElement).appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}