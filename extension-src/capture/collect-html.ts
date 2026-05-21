/**
 * P1 — Collect HTML (CS). Source: spec/21-app/03-full-page-export.md.
 * Returns a serialized snapshot of the document; never mutates the live DOM.
 */
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { MessageError } from "@shared/messaging";
import { serializeWithShadow, countOpenShadowRoots } from "./shadow-serializer";

export interface CollectHtmlOptions {
  redactPasswordFields: boolean;
  /** v2: expand open shadow roots into declarative <template>. Default true. */
  expandShadowRoots?: boolean;
}

export function collectHtml(opts: CollectHtmlOptions, doc: Document = document): string {
  try {
    const serializer = new XMLSerializer();
    const serializedDoctype = doc.doctype
      ? serializer.serializeToString(doc.doctype)
      : "<!DOCTYPE html>";

    const expand = opts.expandShadowRoots !== false;

    // Live <head> injection of <base> + <meta charset> via temporary nodes,
    // then revert. We can't mutate the live doc, so we serialize first and
    // patch the resulting string.
    const root = doc.documentElement;
    const shadowCount = expand ? countOpenShadowRoots(root) : 0;
    let html = serializeWithShadow(root, {
      redactPasswordFields: opts.redactPasswordFields,
      expandShadowRoots: expand,
    });

    // Inject <base> + <meta charset> if absent. Operates on the serialized
    // string so we avoid touching the live DOM.
    const headOpen = html.match(/<head(\s[^>]*)?>/i);
    const headInjections: string[] = [];
    if (!/<meta[^>]*charset=/i.test(html)) {
      headInjections.push('<meta charset="utf-8">');
    }
    if (!/<base[^>]*\shref=/i.test(html)) {
      const href = doc.location?.href ?? "/";
      headInjections.push(`<base href="${href.replace(/"/g, "&quot;")}">`);
    }
    if (headInjections.length) {
      if (headOpen) {
        const i = (headOpen.index ?? 0) + headOpen[0].length;
        html = html.slice(0, i) + headInjections.join("") + html.slice(i);
      } else {
        // No <head> — wrap one in.
        html = html.replace(
          /<html(\s[^>]*)?>/i,
          (m) => `${m}<head>${headInjections.join("")}</head>`,
        );
      }
    }

    if (shadowCount > 0) {
      logger.info(LogCategory.HtmlSerialize, `expanded ${shadowCount} open shadow root(s)`);
    }

    return `${serializedDoctype}\n${html}\n`;
  } catch (e) {
    logger.error(LogCategory.HtmlSerialize, ErrorCode.E_HTML_SERIALIZE, "serialize failed", e);
    throw new MessageError(ErrorCode.E_HTML_SERIALIZE, "Failed to serialize page HTML");
  }
}
