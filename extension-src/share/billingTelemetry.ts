/**
 * B5 — billing telemetry.
 *
 * Lightweight event log for the upgrade / portal flows. Routes through the
 * shared `logger` (visible in chrome://extensions service-worker logs and
 * panel devtools) so we get an audit trail without standing up a backend
 * collector. Each event carries a stable `name`, the surface that
 * triggered it, and an optional `props` bag.
 */
import { LogCategory } from "@shared/enums";
import { logger } from "@shared/logger";

export type BillingSurface =
  | "settings"            // Settings → Smart Share buttons
  | "inline_quota_error"  // Smart Share row CTA after E_SHARE_QUOTA_FREE
  | "pricing_shortcode";  // External marketing surface (informational)

export type BillingEvent =
  | "upgrade_clicked"
  | "checkout_opened"
  | "checkout_failed"
  | "portal_clicked"
  | "portal_opened"
  | "portal_failed"
  | "quota_exhausted_seen";

export interface BillingTelemetryProps {
  reason?: string;
  freeUsed?: number;
  freeLimit?: number;
  [k: string]: unknown;
}

export function emitBilling(
  event: BillingEvent,
  surface: BillingSurface,
  props: BillingTelemetryProps = {},
): void {
  logger.info(
    LogCategory.Billing,
    event.toUpperCase(),
    `billing.${event}`,
    { surface, ...props },
  );
}