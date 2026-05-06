/**
 * P1 — Collect HTML (CS). Source: spec/21-app/03-full-page-export.md.
 * Returns a serialized snapshot of the document; never mutates the live DOM.
 */
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError } from "@shared/messaging";

export interface CollectHtmlOptions {
  redactPasswordFields: boolean;
}

export function collectHtml(opts: CollectHtmlOptions, doc: Document = document): string {
  try {
    const serializer = new XMLSerializer();
    const serializedDoctype = doc.doctype
      ? serializer.serializeToString(doc.doctype)
      : "<!DOCTYPE html>";

    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    let head = clone.querySelector("head");
    if (!head) {
      head = doc.createElement("head");
      clone.insertBefore(head, clone.firstChild);
    }

    if (!head.querySelector("base")) {
      const base = doc.createElement("base");
      base.setAttribute("href", doc.location?.href ?? "/");
      head.insertBefore(base, head.firstChild);
    }
    if (!head.querySelector('meta[charset]')) {
      const m = doc.createElement("meta");
      m.setAttribute("charset", "utf-8");
      head.insertBefore(m, head.firstChild);
    }

    if (opts.redactPasswordFields) {
      const inputs = clone.querySelectorAll('input[type="password"]');
      inputs.forEach((el) => {
        (el as HTMLInputElement).value = "";
        el.setAttribute("data-redacted", "true");
      });
    }

    return `${serializedDoctype}\n${clone.outerHTML}\n`;
  } catch (e) {
    logger.error(LogCategory.HtmlSerialize, ErrorCode.E_HTML_SERIALIZE, "serialize failed", e);
    throw new MessageError(ErrorCode.E_HTML_SERIALIZE, "Failed to serialize page HTML");
  }
}
