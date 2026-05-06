/**
 * Aggregator: build RunElementExport payload from a picked target.
 * Source: spec/21-app/05-element-export.md P1..P4 + P6 step 1.
 */
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import type { DomRect, RunElementExportPayload } from "@shared/types";
import { selectorPath } from "./selectorPath";
import { matchedCss } from "./matchedCss";
import { computedDiff } from "./computedDiff";
import { buildIsolatedHtml } from "./buildIsolatedHtml";
import { redactPasswords } from "./redact";
import { serializeWithShadow } from "../capture/shadowSerializer";

export interface CollectElementOptions {
  redactPasswordFields: boolean;
  includeComputedStyles: boolean;
  includeMatchedRules: boolean;
  /** v2: expand open shadow roots into declarative <template>. Default true. */
  expandShadowRoots?: boolean;
}

export interface CollectElementResult extends RunElementExportPayload {
  rect: DomRect; // serializable rect
}

export async function collectElement(
  tabId: number,
  target: Element,
  domRect: DOMRect,
  opts: CollectElementOptions,
): Promise<CollectElementResult> {
  const rect: DomRect = {
    x: domRect.x, y: domRect.y, width: domRect.width, height: domRect.height,
  };
  if (rect.width === 0 || rect.height === 0) {
    throw new MessageError(ErrorCode.E_ELEMENT_ZERO_SIZE, "Element has zero size");
  }

  const path = selectorPath(target);
  const expand = opts.expandShadowRoots !== false;
  let outer: string;
  if (expand) {
    outer = serializeWithShadow(target, {
      redactPasswordFields: opts.redactPasswordFields,
      expandShadowRoots: true,
    });
  } else {
    outer = target.outerHTML;
    if (opts.redactPasswordFields) outer = redactPasswords(outer);
  }

  const matched = await matchedCss(target, { include: opts.includeMatchedRules });
  const diff = computedDiff(target, { include: opts.includeComputedStyles });
  const isolatedHtml = buildIsolatedHtml({
    baseHref: location.href,
    matchedCss: matched.css,
    outerHtml: outer,
  });

  return {
    tabId,
    selectorPath: path,
    rect,
    outerHtml: outer,
    matchedCss: matched.css,
    computedDiff: diff,
    isolatedHtml,
  };
}
