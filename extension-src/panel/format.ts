/**
 * String interpolation helper for COPY templates that contain {placeholders}.
 * Pure — kept separate so it is unit-testable without React.
 */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? `{${key}}` : String(v);
  });
}
