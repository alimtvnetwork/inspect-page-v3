/**
 * ExportDiagnostics — surfaces structured cause for export failures.
 *
 * Background enriches `detail` as: `<rawCause> || phase=<name>#<n> | tabStatus=<s> | startUrl=<u> | nowUrl=<u>`.
 * We split that envelope back out so users see exactly which phase/attempt
 * failed and the real underlying error, instead of only the surface code.
 *
 * Extracted from ExportPanel.tsx (B1 r10).
 */
import type { ErrorCode } from "@shared/enums";

export interface ExportDiagnosticsProps {
  code?: ErrorCode;
  message?: string;
  detail?: string;
}

export function ExportDiagnostics({ code, message, detail }: ExportDiagnosticsProps): JSX.Element | null {
  if (!code && !message && !detail) return null;
  const detailText = detail ?? "";
  const looksStructured = /(^| \| )\w+=/.test(detailText);
  const [rawCausePart, diagPart] = detailText.includes(" || ")
    ? detailText.split(" || ", 2) as [string, string]
    : looksStructured
      ? ["", detailText]
      : [detailText, ""];
  const fields: Record<string, string> = {};
  for (const tok of diagPart.split(" | ").map((s) => s.trim()).filter(Boolean)) {
    const eq = tok.indexOf("=");
    if (eq > 0) fields[tok.slice(0, eq)] = tok.slice(eq + 1);
  }
  const phase = fields.phase ?? "";
  const phaseName = phase.includes("#") ? phase.split("#")[0] : phase;
  const phaseAttempt = phase.includes("#") ? phase.split("#")[1] : "";
  const rows: Array<[string, string]> = [];
  if (code) rows.push(["Code", code]);
  if (phaseName) rows.push(["Phase", phaseName]);
  if (phaseAttempt) rows.push(["Attempt", `#${phaseAttempt}`]);
  if (fields.tabStatus) rows.push(["Tab status", fields.tabStatus]);
  if (fields.startUrl) rows.push(["Start URL", fields.startUrl]);
  if (fields.nowUrl) rows.push(["Now URL", fields.nowUrl]);
  if (rawCausePart && rawCausePart !== message) rows.push(["Cause", rawCausePart]);
  return (
    <details className="lpe-export-diagnostics" open>
      <summary>Export diagnostics</summary>
      <div className="lpe-export-diagnostics-body">
        {message && (
          <div className="lpe-export-diagnostics-message">
            <strong>Message: </strong>{message}
          </div>
        )}
        {rows.length > 0 && (
          <table>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}