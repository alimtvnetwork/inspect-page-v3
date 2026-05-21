/**
 * P3 — Matched-rule walker. Source: spec/21-app/05-element-export.md.
 *
 * For each style rule in the document, if `target.matches(selector)` we keep
 * the rule's text with a /* from: <source> *\/ header. Cross-origin sheets
 * are fetched and parsed in a detached HTMLDocument so their cssRules are
 * accessible. Inside @media we recurse only when the media currently matches.
 */
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";

export interface MatchedCssOptions { include: boolean }
export interface MatchedCssResult { css: string }

export async function matchedCss(target: Element, opts: MatchedCssOptions): Promise<MatchedCssResult> {
  if (!opts.include) return { css: "" };

  const out: string[] = [];
  let hasAtRuleSkipped = false;
  const sheets = Array.from(document.styleSheets) as CSSStyleSheet[];

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const header = sheet.href ?? `inline #${i + 1}`;
    let rules: CSSRule[] | null = null;

    try {
      rules = Array.from(sheet.cssRules);
    } catch {
      if (sheet.href) {
        try {
          const text = await (await fetch(sheet.href, { credentials: "omit" })).text();
          rules = await parseSheetText(text);
        } catch (e) {
          logger.warn(LogCategory.Element, ErrorCode.W_CSS_PARSE_FAILED, sheet.href, e);
          continue;
        }
      } else {
        continue;
      }
    }

    if (rules) {
      walkRules(rules, target, header, out, () => { hasAtRuleSkipped = true; });
    }
  }

  if (hasAtRuleSkipped) {
    logger.warn(LogCategory.Element, ErrorCode.W_AT_RULE_SKIPPED, "ignored @supports/@layer/@container");
  }

  return { css: out.join("\n\n") };
}

function walkRules(
  rules: CSSRule[], target: Element, header: string, out: string[], onAtRuleSkipped: () => void,
): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      try {
        if (target.matches(rule.selectorText)) {
          out.push(`/* from: <${header}> */\n${rule.cssText}`);
        }
      } catch (e) {
        logger.warn(LogCategory.Element, ErrorCode.W_SELECTOR_INVALID, rule.selectorText, e);
      }
    } else if (rule instanceof CSSMediaRule) {
      if (window.matchMedia(rule.conditionText).matches) {
        walkRules(Array.from(rule.cssRules), target, header, out, onAtRuleSkipped);
      }
    } else {
      onAtRuleSkipped();
    }
  }
}

async function parseSheetText(text: string): Promise<CSSRule[]> {
  // Use a detached HTMLDocument so its <style> sheet exposes cssRules.
  const doc = document.implementation.createHTMLDocument("parse-css");
  const style = doc.createElement("style");
  style.textContent = text;
  doc.head.appendChild(style);
  const sheet = style.sheet as CSSStyleSheet | null;
  if (!sheet) return [];
  try {
    return Array.from(sheet.cssRules);
  } catch {
    return [];
  }
}
