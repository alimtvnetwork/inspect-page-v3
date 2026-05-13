/**
 * Phase A11 — DOM-side helper to trigger a file download from a string.
 * Kept tiny + isolated so the serializers in `inspect/exportSnapshot.ts`
 * stay pure and testable.
 */
export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}