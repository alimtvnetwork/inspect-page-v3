/**
 * 2.6.0 — pure helper used by `BillingPanel` to decide whether the
 * "You're Pro 🎉" toast should fire on a `/billing/status` refresh.
 *
 * The toast must fire exactly once per upgrade transition:
 *   - Only when we have a *prior* observation (so the first poll on a
 *     freshly-loaded popup never auto-fires for already-Pro users).
 *   - Only when the prior plan was something other than "pro" (covers
 *     both "free" and the rare null/unknown legacy plan strings).
 *   - Only when the next plan is exactly "pro".
 *
 * Extracted from the inline closure in `ExportPanel.tsx::BillingPanel`
 * so we can unit-test the transition matrix without standing up React
 * Testing Library for one rule.
 */
export type Plan = "free" | "pro" | string | null | undefined;

export function detectProFlip(prev: Plan, next: Plan): boolean {
  if (!prev) return false;
  if (prev === "pro") return false;
  return next === "pro";
}