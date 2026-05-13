/**
 * P1.5 — Iframe traversal (v2 / spec/19-edge-cases.md).
 *
 * For every <iframe> inside an already-serialized document:
 *   - **Same-origin**: recursively serialize the iframe's contentDocument
 *     (HTML + CSS + adopted stylesheets via the shadow walker, then font
 *     bundling), base64 it, and replace the live `src` with a
 *     `srcdoc="…"` so the export renders fully offline.
 *   - **Cross-origin**: leave the original `src` untouched, add a
 *     `data-inspect-page-cross-origin="true"` marker, and bump a counter so
 *     QA and meta can surface the limitation.
 *
 * This runs against the serialized HTML *string* (not the live DOM) so we
 * never mutate the page. We use DOMParser to find iframe placeholders,
 * resolve them back to live `HTMLIFrameElement`s by `selectorPath`, and
 * splice the `srcdoc` attribute into the output.
 */
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";
import { serializeWithShadow } from "./shadowSerializer";
import { inlineFonts } from "./inlineFonts";

export interface InlineIframesOptions {
  redactPasswordFields?: boolean;
  /** Recurse into nested same-origin iframes. Default true. */
  recurse?: boolean;
  /** Max recursion depth (defense in depth). Default 3. */
  maxDepth?: number;
  /** Inline @font-face binaries inside iframe stylesheets too. Default true. */
  inlineFontBinaries?: boolean;
}

export interface InlineIframesCounts {
  total: number;
  sameOrigin: number;
  crossOrigin: number;
  failed: number;
  bytesInlined: number;
}

export interface InlineIframesResult {
  html: string;
  counts: InlineIframesCounts;
}

/**
 * Test whether an iframe's contentDocument is reachable. Cross-origin access
 * throws SecurityError; sandboxed/loading iframes return null.
 */
function readableContentDocument(frame: HTMLIFrameElement): Document | null {
  try {
    const doc = frame.contentDocument;
    if (!doc) return null;
    // Touch a property that triggers the same-origin check.
    void doc.documentElement;
    return doc;
  } catch {
    return null;
  }
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Serialize a same-origin sub-document into a single self-contained HTML
 * string suitable for srcdoc. Mirrors the full-page pipeline at a smaller
 * scope: shadow-aware HTML walk, then per-stylesheet inlining via the
 * doc's own .styleSheets, then optional font binary bundling.
 */
async function serializeSubDocument(
  doc: Document,
  opts: Required<Pick<InlineIframesOptions, "redactPasswordFields" | "inlineFontBinaries" | "recurse" | "maxDepth">>,
  depth: number,
): Promise<string> {
  // 1. HTML (shadow-aware, redaction-aware).
  let html = serializeWithShadow(doc.documentElement, {
    redactPasswordFields: opts.redactPasswordFields,
    expandShadowRoots: true,
    captureAdoptedStyleSheets: true,
  });

  // 2. Inline reachable stylesheets as a single <style> block in <head>.
  const sheets = Array.from(doc.styleSheets) as CSSStyleSheet[];
  let css = "";
  for (const s of sheets) {
    try {
      const rules = s.cssRules;
      for (let i = 0; i < rules.length; i += 1) css += rules[i].cssText + "\n";
    } catch {
      // cross-origin or otherwise unreadable — skip.
    }
  }

  // 3. Bundle font binaries.
  if (opts.inlineFontBinaries && css) {
    try {
      const r = await inlineFonts(css, { baseUrl: doc.location?.href });
      css = r.css;
    } catch {
      // fall through with un-inlined CSS
    }
  }

  if (css) {
    const styleTag = `<style data-inspect-page-iframe-css="true">${css}</style>`;
    const headOpen = html.match(/<head(\s[^>]*)?>/i);
    if (headOpen) {
      const i = (headOpen.index ?? 0) + headOpen[0].length;
      html = html.slice(0, i) + styleTag + html.slice(i);
    } else {
      html = html.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${styleTag}</head>`);
    }
  }

  // 4. Recurse into nested iframes (within the same sub-document).
  if (opts.recurse && depth < opts.maxDepth) {
    const nested = await inlineIframesInDocument(html, doc, opts, depth + 1);
    html = nested.html;
  }

  return `<!DOCTYPE html>${html}`;
}

/**
 * Walk the *live* document for iframes, build a `srcdoc` for each
 * same-origin one, and splice the result into the serialized HTML string
 * by matching on the iframe's `src` (live) → searched in serialized html.
 *
 * Matching by src is robust because (a) we just serialized this document,
 * so the src in the string equals the live src, and (b) iframes without
 * src that are written via document.write are rare and will simply be
 * left as-is.
 */
export async function inlineIframesInDocument(
  serializedHtml: string,
  liveDoc: Document,
  opts: Required<Pick<InlineIframesOptions, "redactPasswordFields" | "inlineFontBinaries" | "recurse" | "maxDepth">>,
  depth: number,
): Promise<InlineIframesResult> {
  const counts: InlineIframesCounts = {
    total: 0, sameOrigin: 0, crossOrigin: 0, failed: 0, bytesInlined: 0,
  };
  const frames = Array.from(liveDoc.querySelectorAll("iframe")) as HTMLIFrameElement[];
  if (frames.length === 0) return { html: serializedHtml, counts };

  // Build replacements: array of { needle, replacement }.
  const edits: Array<{ needle: RegExp; replacement: string; markCrossOrigin: boolean }> = [];

  for (const frame of frames) {
    counts.total += 1;
    const src = frame.getAttribute("src") || "";
    const subDoc = readableContentDocument(frame);

    if (!subDoc) {
      counts.crossOrigin += 1;
      edits.push({
        // Find this exact <iframe ...> opening tag in the serialized HTML
        // (matched by src + position-agnostic). This is best-effort: if
        // multiple frames share the same src we add the marker to all of
        // them, which is fine — they're all cross-origin from our POV.
        needle: buildIframeRegex(src),
        replacement: "", // computed below as needle-aware rewrite
        markCrossOrigin: true,
      });
      continue;
    }

    try {
      const srcdoc = await serializeSubDocument(subDoc, opts, depth);
      counts.sameOrigin += 1;
      counts.bytesInlined += srcdoc.length;
      edits.push({
        needle: buildIframeRegex(src),
        replacement: srcdoc, // injected as srcdoc="..." below
        markCrossOrigin: false,
      });
    } catch (e) {
      counts.failed += 1;
      logger.warn(LogCategory.HtmlSerialize, ErrorCode.E_HTML_SERIALIZE,
        `iframe traversal failed for ${src}`, e);
    }
  }

  // Apply edits left-to-right, advancing past each replacement.
  let html = serializedHtml;
  for (const edit of edits) {
    edit.needle.lastIndex = 0;
    const match = edit.needle.exec(html);
    if (!match) continue;
    const tag = match[0];
    let rewritten: string;
    if (edit.markCrossOrigin) {
      rewritten = injectAttrs(tag, { "data-inspect-page-cross-origin": "true" });
    } else {
      rewritten = injectAttrs(tag, {
        srcdoc: edit.replacement,
        "data-inspect-page-srcdoc": "true",
      });
    }
    html = html.slice(0, match.index) + rewritten + html.slice(match.index + tag.length);
  }

  // Surface cross-origin frames once per traversal pass: spec/19-edge-cases E1/E2.
  if (counts.crossOrigin > 0 && depth === 0) {
    logger.warn(
      LogCategory.HtmlSerialize, ErrorCode.W_IFRAME_NOT_TRAVERSED,
      `${counts.crossOrigin} cross-origin iframe(s) left as opaque references`,
    );
    logger.warn(
      LogCategory.HtmlSerialize, ErrorCode.E_IFRAME_CROSS_ORIGIN,
      "cross-origin iframe contents could not be inlined; export keeps the original src",
    );
  }

  return { html, counts };
}

/** Build a regex that matches an <iframe ...> opening tag with the given src. */
function buildIframeRegex(src: string): RegExp {
  const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (src) {
    // Match an iframe opening tag whose src attribute equals the given value.
    return new RegExp(`<iframe\\b[^>]*\\bsrc=(?:"${escapedSrc}"|'${escapedSrc}')[^>]*>`, "i");
  }
  // No src: match any iframe lacking a src attribute.
  return /<iframe\b(?![^>]*\bsrc=)[^>]*>/i;
}

/** Add or replace attributes on a serialized <iframe> opening tag. */
function injectAttrs(openTag: string, attrs: Record<string, string>): string {
  let inner = openTag.slice(1, -1); // strip < … >
  // Preserve self-closing slash if present.
  let trailing = "";
  if (inner.endsWith("/")) {
    trailing = "/";
    inner = inner.slice(0, -1).trimEnd();
  }
  for (const [k, v] of Object.entries(attrs)) {
    // Drop any existing copy of this attribute.
    const re = new RegExp(`\\s+${k}="[^"]*"`, "i");
    inner = inner.replace(re, "");
    inner += ` ${k}="${escapeAttr(v)}"`;
  }
  return `<${inner}${trailing}>`;
}

/** Top-level entry point. Counts apply only to the outermost document. */
export async function inlineIframes(
  serializedHtml: string,
  liveDoc: Document = document,
  opts: InlineIframesOptions = {},
): Promise<InlineIframesResult> {
  return inlineIframesInDocument(serializedHtml, liveDoc, {
    redactPasswordFields: !!opts.redactPasswordFields,
    recurse: opts.recurse !== false,
    maxDepth: opts.maxDepth ?? 3,
    inlineFontBinaries: opts.inlineFontBinaries !== false,
  }, 0);
}