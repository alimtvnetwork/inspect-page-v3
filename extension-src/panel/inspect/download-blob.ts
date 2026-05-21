/**
 * Phase A11 — DOM-side helper to trigger a file download from a string.
 *
 * Uses a synthetic `<a download>` click so downloads go straight to the
 * browser's default download folder, honoring the user's Chrome download
 * preference (no forced Save As… prompt). `showSaveFilePicker` is avoided
 * because it is blocked inside the in-page floating panel iframe (silent
 * failure → nothing downloads) and, where allowed, forces a folder picker
 * on every export.
 */
function anchorDownload(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime: string): void {
  anchorDownload(text, filename, mime);
}