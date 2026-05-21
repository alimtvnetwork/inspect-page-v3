/**
 * Format Stripe price metadata returned by `/billing/status` into a
 * user-facing tagline. Falls back to the static $5/mo copy when the
 * WP plugin couldn't enrich the response (older plugin, missing
 * secret/network error, etc.).
 */
import type { BillingStatus } from "./get-billing-status";

const FALLBACK = "$5 / month — unlimited Smart Shares";

export function formatBillingPriceTagline(
  price: BillingStatus["price"] | undefined,
  fallback: string = FALLBACK,
): string {
  if (!price || price.unitAmount == null || !price.currency) return fallback;
  const major = price.unitAmount / 100;
  let amount: string;
  try {
    amount = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: price.currency,
      minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    amount = `${major} ${price.currency}`;
  }
  const interval = price.interval ?? "month";
  return `${amount} / ${interval} — unlimited Smart Shares`;
}