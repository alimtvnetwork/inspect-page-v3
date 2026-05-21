/**
 * M1 — typed JSON narrowing helpers.
 *
 * Replaces unsafe `as ElementSnapshot` / `as InspectSnapshot` casts on
 * cross-context payloads (background → panel, content-script → panel) with
 * cheap structural runtime guards. The guards check only the minimum set
 * of top-level keys that downstream code unconditionally reads — they are
 * NOT exhaustive validators. Anything that passes is safe to cast at the
 * call site; anything that fails is returned as `undefined` so callers can
 * skip rendering instead of crashing on `cannot read property of undefined`.
 */
import type { ElementSnapshot } from "../element/collectElementSnapshot";
import type { InspectSnapshot } from "../inspect/types";

const isObj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object";

/** Returns true if `x` has the structural shape of an `ElementSnapshot`. */
export function isElementSnapshot(x: unknown): x is ElementSnapshot {
  if (!isObj(x)) return false;
  const identity = x.identity as Record<string, unknown> | undefined;
  const box = x.box as Record<string, unknown> | undefined;
  return (
    isObj(identity) &&
    typeof identity.tag === "string" &&
    typeof identity.selectorPath === "string" &&
    isObj(box)
  );
}

/** Cast helper: returns the snapshot or `undefined` if shape check fails. */
export function asElementSnapshot(x: unknown): ElementSnapshot | undefined {
  return isElementSnapshot(x) ? x : undefined;
}

/** Returns true if `x` has the structural shape of an `InspectSnapshot`. */
export function isInspectSnapshot(x: unknown): x is InspectSnapshot {
  if (!isObj(x)) return false;
  return (
    isObj(x.pageInfo) &&
    Array.isArray(x.fonts) &&
    Array.isArray(x.colors) &&
    typeof x.collectedAt === "number"
  );
}

/** Cast helper: returns the snapshot or `undefined` if shape check fails. */
export function asInspectSnapshot(x: unknown): InspectSnapshot | undefined {
  return isInspectSnapshot(x) ? x : undefined;
}