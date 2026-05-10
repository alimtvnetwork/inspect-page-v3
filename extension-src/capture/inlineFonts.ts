/**
 * P2.5 — Font binary bundling (v2 / spec/19-edge-cases.md).
 *
 * Scans collected CSS for `@font-face { ... src: url(...) ... }` declarations,
 * fetches each referenced binary, base64-encodes it, and rewrites the url(...)
 * to a `data:` URI. Result: exports render with their original typography
 * offline, independent of the source CDN.
 *
 * Constraints (per spec/19-edge-cases.md):
 *  - Skip already-inlined `data:` URLs.
 *  - Cap per-font size (default 1 MiB) and total bundle size (default 5 MiB)
 *    so we never blow up the 1.5 MiB extension package or produce 50 MiB
 *    exports for sites that ship dozens of weights.
 *  - Cross-origin fetches use `credentials: "omit"` to match collectCss().
 *  - Failures are logged + counted, never thrown — the original `url(...)` is
 *    preserved so the page still tries the network at view time.
 */
import { ErrorCode, LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";

export interface InlineFontsOptions {
  /** Max bytes per individual font file (default 1 MiB). */
  maxPerFontBytes?: number;
  /** Max cumulative inlined font bytes (default 5 MiB). */
  maxTotalBytes?: number;
  /** Base URL for resolving relative url(...) values. Defaults to location.href. */
  baseUrl?: string;
  /** Injected fetch (tests). Defaults to global fetch. */
  fetcher?: typeof fetch;
}

export interface InlineFontsCounts {
  candidates: number;
  inlined: number;
  skippedAlreadyData: number;
  skippedTooLarge: number;
  skippedBudget: number;
  failed: number;
  bytesInlined: number;
}

export interface InlineFontsResult {
  css: string;
  counts: InlineFontsCounts;
}

const DEFAULT_PER = 1 * 1024 * 1024;
const DEFAULT_TOTAL = 5 * 1024 * 1024;

/**
 * Map common font extensions to MIME types. Used as a fallback when the
 * server omits Content-Type or returns a generic application/octet-stream.
 */
function mimeForUrl(url: string): string {
  const m = url.toLowerCase().match(/\.(woff2|woff|ttf|otf|eot|svg)(\?|#|$)/);
  switch (m?.[1]) {
    case "woff2": return "font/woff2";
    case "woff":  return "font/woff";
    case "ttf":   return "font/ttf";
    case "otf":   return "font/otf";
    case "eot":   return "application/vnd.ms-fontobject";
    case "svg":   return "image/svg+xml";
    default:      return "application/octet-stream";
  }
}

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Chunk to avoid "Maximum call stack size exceeded" on large fonts.
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return btoa(bin);
}

/**
 * Match every url(...) occurrence inside an @font-face src value. We only
 * touch CSS inside @font-face blocks — other url(...) (background images,
 * cursors, masks) are out of scope for this v2 feature.
 */
const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/gi;
const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

export async function inlineFonts(
  css: string,
  opts: InlineFontsOptions = {},
): Promise<InlineFontsResult> {
  const perCap = opts.maxPerFontBytes ?? DEFAULT_PER;
  const totalCap = opts.maxTotalBytes ?? DEFAULT_TOTAL;
  const base = opts.baseUrl ?? (typeof location !== "undefined" ? location.href : "https://example.com/");
  const doFetch = opts.fetcher ?? (typeof fetch !== "undefined" ? fetch : undefined);

  const counts: InlineFontsCounts = {
    candidates: 0,
    inlined: 0,
    skippedAlreadyData: 0,
    skippedTooLarge: 0,
    skippedBudget: 0,
    failed: 0,
    bytesInlined: 0,
  };

  if (!doFetch) return { css, counts };

  // Cache: same URL referenced from multiple @font-face blocks → fetch once.
  const cache = new Map<string, Promise<string | null>>();

  const fetchAsDataUri = (absUrl: string): Promise<string | null> => {
    let p = cache.get(absUrl);
    if (p) return p;
    p = (async () => {
      try {
        const res = await doFetch(absUrl, { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (buf.byteLength > perCap) {
          counts.skippedTooLarge += 1;
          return null;
        }
        if (counts.bytesInlined + buf.byteLength > totalCap) {
          counts.skippedBudget += 1;
          return null;
        }
        const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || mimeForUrl(absUrl);
        const b64 = bytesToBase64(buf);
        counts.bytesInlined += buf.byteLength;
        counts.inlined += 1;
        return `data:${mime};base64,${b64}`;
      } catch (e) {
        counts.failed += 1;
        logger.warn(LogCategory.CssCollect, ErrorCode.W_FONT_UNREACHABLE, `font fetch failed: ${absUrl}`, e);
        return null;
      }
    })();
    cache.set(absUrl, p);
    return p;
  };

  // Two-pass: collect every @font-face block and the URLs inside, kick off
  // fetches in parallel, then splice the rewritten blocks back into the CSS.
  type Job = { match: string; index: number; rewritePromise: Promise<string> };
  const jobs: Job[] = [];

  let m: RegExpExecArray | null;
  FONT_FACE_RE.lastIndex = 0;
  while ((m = FONT_FACE_RE.exec(css)) !== null) {
    const block = m[0];
    const start = m.index;
    const urlPromises: Array<Promise<{ original: string; replacement: string | null }>> = [];
    URL_RE.lastIndex = 0;
    let u: RegExpExecArray | null;
    while ((u = URL_RE.exec(block)) !== null) {
      const original = u[0];
      const raw = u[2].trim();
      counts.candidates += 1;
      if (raw.startsWith("data:")) {
        counts.skippedAlreadyData += 1;
        urlPromises.push(Promise.resolve({ original, replacement: null }));
        continue;
      }
      let abs: string;
      try { abs = new URL(raw, base).toString(); }
      catch { counts.failed += 1; urlPromises.push(Promise.resolve({ original, replacement: null })); continue; }
      urlPromises.push(
        fetchAsDataUri(abs).then((data) => ({
          original,
          replacement: data ? `url("${data}")` : null,
        })),
      );
    }
    const rewritePromise = Promise.all(urlPromises).then((rewrites) => {
      let out = block;
      for (const r of rewrites) {
        if (r.replacement) {
          // Replace only the first remaining occurrence to avoid touching
          // identical url() strings more than once.
          const i = out.indexOf(r.original);
          if (i >= 0) out = out.slice(0, i) + r.replacement + out.slice(i + r.original.length);
        }
      }
      return out;
    });
    jobs.push({ match: block, index: start, rewritePromise });
  }

  if (jobs.length === 0) return { css, counts };

  const rewrittenBlocks = await Promise.all(jobs.map((j) => j.rewritePromise));

  // Splice from the end so earlier indices stay valid.
  let out = css;
  for (let i = jobs.length - 1; i >= 0; i -= 1) {
    const j = jobs[i];
    out = out.slice(0, j.index) + rewrittenBlocks[i] + out.slice(j.index + j.match.length);
  }

  return { css: out, counts };
}