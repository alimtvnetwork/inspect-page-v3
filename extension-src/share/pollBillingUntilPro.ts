/**
 * Option C — Phase 4: post-checkout poll.
 *
 * After the user opens Stripe Checkout in a new tab, the panel cannot
 * observe the redirect. Instead we poll `/billing/status` every few
 * seconds and resolve as soon as the WP webhook flips the license to
 * "active" (plan === "pro"). On flip, we also dispatch a window
 * `CustomEvent('inspect-page:billing-changed')` so any open panel block
 * (BillingPanel, quota row) can refresh without a manual reload.
 */
import { getBillingStatus, type BillingStatus, type GetBillingStatusDeps } from "./getBillingStatus";

export const BILLING_CHANGED_EVENT = "inspect-page:billing-changed";

export interface PollDeps extends GetBillingStatusDeps {
  /** Poll interval in ms. Default 3000. */
  intervalMs?: number;
  /** Stop after this many ms total. Default 5 minutes. */
  timeoutMs?: number;
  /** Optional injection for tests. */
  setTimeoutImpl?: typeof setTimeout;
  clearTimeoutImpl?: typeof clearTimeout;
  dispatchImpl?: (name: string) => void;
}

export interface PollHandle {
  /** Promise resolves with the final status (pro on success, last status on timeout). */
  done: Promise<BillingStatus | null>;
  /** Cancel the poll early. */
  cancel: () => void;
}

export function pollBillingUntilPro(deps: PollDeps): PollHandle {
  const interval = Math.max(500, deps.intervalMs ?? 3000);
  const timeout  = Math.max(interval, deps.timeoutMs ?? 5 * 60 * 1000);
  const setT = deps.setTimeoutImpl ?? setTimeout;
  const clearT = deps.clearTimeoutImpl ?? clearTimeout;
  const dispatch = deps.dispatchImpl ?? ((name: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(name));
    }
  });

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const startedAt = Date.now();
  let last: BillingStatus | null = null;
  let resolveOuter: ((v: BillingStatus | null) => void) | null = null;

  const done = new Promise<BillingStatus | null>((resolve) => {
    resolveOuter = resolve;
    const tick = async (): Promise<void> => {
      if (cancelled) { resolve(last); return; }
      try {
        const s = await getBillingStatus(deps);
        last = s;
        if (s.plan === "pro") {
          dispatch(BILLING_CHANGED_EVENT);
          resolve(s);
          return;
        }
      } catch { /* ignore transient errors, keep polling */ }
      if (Date.now() - startedAt >= timeout) { resolve(last); return; }
      timer = setT(tick, interval) as ReturnType<typeof setTimeout>;
    };
    timer = setT(tick, interval) as ReturnType<typeof setTimeout>;
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      if (timer) clearT(timer);
      if (resolveOuter) { resolveOuter(last); resolveOuter = null; }
    },
  };
}
