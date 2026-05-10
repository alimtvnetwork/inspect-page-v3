/**
 * Clamp `value` to the inclusive `[min, max]` range. Returns `min` when
 * `value` is NaN or when the range is inverted (`max < min`). Pulled out
 * of `mountFloatingPanel.tsx` so unit tests don't drag in the React +
 * JSZip transitive graph.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}