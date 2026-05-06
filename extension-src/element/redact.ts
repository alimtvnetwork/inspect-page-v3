/**
 * Redact value="..." from <input type="password"> inside an outerHTML string.
 * Pure string processing; safe for use in CS.
 */
export function redactPasswords(html: string): string {
  return html.replace(
    /<input\b([^>]*\btype\s*=\s*["']password["'][^>]*)>/gi,
    (match, attrs: string) => {
      const cleaned = attrs.replace(/\bvalue\s*=\s*("[^"]*"|'[^']*')/gi, 'value=""');
      const withFlag = /\bdata-redacted\s*=/.test(cleaned) ? cleaned : `${cleaned} data-redacted="true"`;
      return `<input${withFlag}>`;
    },
  );
}
