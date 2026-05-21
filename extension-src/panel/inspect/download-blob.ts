/**
 * Phase A11 — DOM-side helper to trigger a file download from a string.
 *
 * Prefers the File System Access API (`showSaveFilePicker`) so users get a
 * real Save As… folder picker that matches the rest of the export pipeline.
 * Falls back to a synthetic `<a download>` click on browsers/contexts where
 * `showSaveFilePicker` is unavailable, blocked by permissions policy, or
 * dismissed by the user.
 */
type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
};
type FileSystemWritableFileStream = {
  write(data: BlobPart): Promise<void>;
  close(): Promise<void>;
};
type FileSystemFileHandle = { createWritable(): Promise<FileSystemWritableFileStream> };
type ShowSaveFilePicker = (opts?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;

function extFromName(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : "";
}

function anchorFallback(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime: string): void {
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }).showSaveFilePicker;
  if (typeof picker !== "function") {
    anchorFallback(text, filename, mime);
    return;
  }
  const ext = extFromName(filename) || ".txt";
  void (async () => {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: "Inspect Page export", accept: { [mime]: [ext] } }],
      });
      const stream = await handle.createWritable();
      await stream.write(new Blob([text], { type: mime }));
      await stream.close();
    } catch (e) {
      // User cancellation throws AbortError — don't fall back to a silent save.
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError" || name === "NotAllowedError") return;
      anchorFallback(text, filename, mime);
    }
  })();
}