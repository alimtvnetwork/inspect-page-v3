/**
 * P2 — Collect CSS (CS). Source: spec/21-app/03-full-page-export.md.
 * Inlines every reachable stylesheet with /* === <source> === *\/ headers.
 */
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";

export interface CssCounts {
  inlineStyles: number;
  linkedStylesheets: number;
  unreachableStylesheets: number;
}
export interface CollectCssResult { css: string; counts: CssCounts }

export async function collectCss(doc: Document = document): Promise<CollectCssResult> {
  const counts: CssCounts = { inlineStyles: 0, linkedStylesheets: 0, unreachableStylesheets: 0 };
  const chunks: string[] = [];

  const sheets = Array.from(doc.styleSheets) as CSSStyleSheet[];
  for (const sheet of sheets) {
    let header = sheet.href ?? `inline #${++counts.inlineStyles}`;
    let text = "";

    try {
      const rules = sheet.cssRules;
      text = Array.from(rules).map((r) => r.cssText).join("\n");
      if (sheet.href) counts.linkedStylesheets++;
    } catch {
      // SecurityError on cross-origin: try fetching by href.
      if (sheet.href) {
        try {
          const res = await fetch(sheet.href, { credentials: "omit" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          text = await res.text();
          counts.linkedStylesheets++;
        } catch (e) {
          logger.warn(LogCategory.CssCollect, ErrorCode.W_CSS_FETCH_FAILED, sheet.href, e);
          counts.unreachableStylesheets++;
          header = `unreachable: ${sheet.href}`;
          text = "";
        }
      } else {
        logger.warn(LogCategory.CssCollect, ErrorCode.W_CSS_INLINE_UNREADABLE, "inline cross-origin");
        text = "";
      }
    }

    chunks.push(`/* === <${header}> === */\n${text}`);
  }

  return { css: `${chunks.join("\n\n")}\n`, counts };
}
