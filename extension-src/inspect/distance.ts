/**
 * Phase A8b — Distance guides.
 *
 * Pure helpers that compute Figma-style measurements between two
 * axis-aligned rectangles. All values are integers (px).
 */

export interface Rect { x: number; y: number; w: number; h: number }

export interface Distance {
  /** anchor.left - target.left (positive when target is left of anchor) */
  left: number;
  /** target.right - anchor.right (positive when target extends right) */
  right: number;
  top: number;
  bottom: number;
  /** gap between right edge of the leftmost rect and left edge of the rightmost rect (negative if overlapping on X). */
  hGap: number;
  /** vertical gap, same convention. */
  vGap: number;
  /** True when the two rectangles intersect on both axes. */
  overlap: boolean;
}

export function distanceBetween(anchor: Rect, target: Rect): Distance {
  const aRight = anchor.x + anchor.w;
  const aBottom = anchor.y + anchor.h;
  const tRight = target.x + target.w;
  const tBottom = target.y + target.h;

  const left = Math.round(anchor.x - target.x);
  const right = Math.round(tRight - aRight);
  const top = Math.round(anchor.y - target.y);
  const bottom = Math.round(tBottom - aBottom);

  const hGap = Math.round(target.x >= aRight
    ? target.x - aRight
    : anchor.x >= tRight
      ? anchor.x - tRight
      : -Math.min(aRight, tRight) + Math.max(anchor.x, target.x));
  const vGap = Math.round(target.y >= aBottom
    ? target.y - aBottom
    : anchor.y >= tBottom
      ? anchor.y - tBottom
      : -Math.min(aBottom, tBottom) + Math.max(anchor.y, target.y));

  const overlap = hGap < 0 && vGap < 0;
  return { left, right, top, bottom, hGap, vGap, overlap };
}