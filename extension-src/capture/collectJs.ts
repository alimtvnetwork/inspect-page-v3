/**
 * P3 — Collect JS (CS). Source: spec/21-app/03-full-page-export.md.
 * Source is shipped, not executed.
 */
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";

export interface JsCounts {
  inlineScripts: number;
  linkedScripts: number;
  unreachableScripts: number;
}
export interface CollectJsResult { js: string; counts: JsCounts }

const SKIP_TYPES = new Set(["application/json", "application/ld+json", "importmap"]);

export async function collectJs(doc: Document = document): Promise<CollectJsResult> {
  const counts: JsCounts = { inlineScripts: 0, linkedScripts: 0, unreachableScripts: 0 };
  const chunks: string[] = [];

  const scripts = Array.from(doc.querySelectorAll("script"));
  for (const script of scripts) {
    const type = (script.getAttribute("type") || "").toLowerCase();
    if (type && SKIP_TYPES.has(type)) continue;

    const src = script.getAttribute("src");
    let header: string;
    let text: string;

    if (!src) {
      header = `inline #${++counts.inlineScripts}`;
      text = script.textContent ?? "";
    } else {
      try {
        const url = new URL(src, doc.location?.href ?? location.href).toString();
        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
        header = url;
        counts.linkedScripts++;
      } catch (e) {
        logger.warn(LogCategory.JsCollect, ErrorCode.W_JS_FETCH_FAILED, src, e);
        counts.unreachableScripts++;
        header = `unreachable: ${src}`;
        text = "";
      }
    }
    chunks.push(`/* === <${header}> === */\n${text}`);
  }

  return { js: `${chunks.join("\n\n")}\n`, counts };
}
