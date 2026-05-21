/**
 * Share-related settings UI extracted from ExportPanel.tsx (B1 refactor).
 *
 * Exports:
 *   - ShareSettingsSection — sign-in / quota / billing controls inside the
 *     popup's Settings drawer.
 *   - ShareDialog — modal shown after a successful Smart Share, listing the
 *     four share URLs + AI prompt block, with countdown + revoke.
 *   - formatRemaining — countdown formatter used by ShareDialog.
 *
 * Internal helpers: BillingPanel, RecentSharesList.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { COPY, interpolateAi } from "@shared/copy";
import { INSPECT_PAGE_WP_SITE_URL, INSPECT_PAGE_PRICING_URL } from "@shared/constants";
import { MessageKind as MK } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { ShareSettings, CreateShareSessionResponse } from "@shared/types";
import { getShareSettings, setShareSettings } from "@shared/shareSettings";
import { listShareSessions, type ShareSessionSummary } from "../share/listShareSessions";
import { startBillingCheckout } from "../share/startBillingCheckout";
import { startBillingPortal } from "../share/startBillingPortal";
import { getBillingStatus, type BillingStatus } from "../share/getBillingStatus";
import { formatBillingPriceTagline } from "../share/formatPrice";
import { detectProFlip } from "../share/detectProFlip";
import { pollBillingUntilPro, BILLING_CHANGED_EVENT } from "../share/pollBillingUntilPro";
import { emitBilling } from "../share/billingTelemetry";
import { revokeShareSession } from "../share/revokeShareSession";

export interface ShareSettingsSectionProps {
  settings: ShareSettings;
  onPatch: (patch: Partial<ShareSettings>) => void;
}

/**
 * Option C — Phase 3: Pricing card / active-license panel.
 *
 * Reads the enriched `/billing/status` (Phase 1) via `getBillingStatus`
 * and renders a compact plan badge + masked subscription id (Pro) or
 * persistent upgrade tagline (Free). Sits inside the Settings popover
 * above the existing quota block, which still drives the per-share
 * progress bar from `/auth-status`.
 */
function BillingPanel({ signedIn }: { signedIn: boolean }): JSX.Element | null {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [justFlippedPro, setJustFlippedPro] = useState(false);
  useEffect(() => {
    if (!signedIn) { setStatus(null); return; }
    let isAborted = false;
    let prevPlan: string | null = null;
    const refresh = async () => {
      try {
        const s = await getBillingStatus({ getShareSettings });
        if (!isAborted) {
          if (detectProFlip(prevPlan, s.plan)) {
            setJustFlippedPro(true);
            if (typeof window !== "undefined") {
              window.setTimeout(() => setJustFlippedPro(false), 6000);
            }
          }
          prevPlan = s.plan;
          setStatus(s);
        }
      } catch { if (!isAborted) setStatus(null); }
    };
    void refresh();
    if (typeof window === "undefined") return () => { isAborted = true; };
    const onFocus = () => { void refresh(); };
    const onChanged = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener(BILLING_CHANGED_EVENT, onChanged);
    return () => {
      isAborted = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(BILLING_CHANGED_EVENT, onChanged);
    };
  }, [signedIn]);
  if (!status) return null;
  const isPro = status.plan === "pro";
  const sub = status.subscription
    ? `${status.subscription.slice(0, 8)}…${status.subscription.slice(-4)}`
    : "";
  return (
    <div
      className="lpe-billing-panel"
      data-plan={status.plan}
      role="group"
      aria-label={COPY.billingPlanLabel}
    >
      <div className="lpe-billing-row">
        <span className="lpe-billing-label">{COPY.billingPlanLabel}</span>
        <span className="lpe-billing-badge" data-plan={status.plan}>
          {isPro ? COPY.billingPlanPro : COPY.billingPlanFree}
        </span>
      </div>
      {isPro && sub && (
        <div className="lpe-billing-row">
          <span className="lpe-billing-label">{COPY.billingSubscriptionLabel}</span>
          <code className="lpe-billing-sub">{sub}</code>
        </div>
      )}
      {!isPro && (
        <>
          <div className="lpe-billing-tagline">
            {formatBillingPriceTagline(status.price, COPY.billingPriceTagline)}
          </div>
          <ul className="lpe-billing-features" aria-label="Pro features">
            <li>{COPY.billingFeatureUnlimited}</li>
            <li>{COPY.billingFeaturePriority}</li>
            <li>{COPY.billingFeatureVisitors}</li>
            <li>{COPY.billingFeatureSupport}</li>
          </ul>
        </>
      )}
      {justFlippedPro && (
        <div className="lpe-billing-toast" role="status" aria-live="polite">
          {COPY.billingProToast}
        </div>
      )}
    </div>
  );
}

export function ShareSettingsSection({ settings, onPatch }: ShareSettingsSectionProps): JSX.Element {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [quota, setQuota] = useState<{
    lifetimeUsed: number; freeLimit: number; hasLicense: boolean;
  } | null>(null);
  const siteUrl = INSPECT_PAGE_WP_SITE_URL;
  const configured = !!siteUrl;
  const signedIn = configured && !!settings.nonce && !!settings.userId;

  const onSignIn = async (): Promise<void> => {
    if (!configured) { setErr(COPY.shareNotConfiguredMsg); return; }
    setErr("");
    try {
      await sendToBackground<{ siteUrl: string }, void>(MK.OpenLoginPopup, { siteUrl });
      setHint(COPY.shareLoginOpenedMsg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const onRefresh = async (): Promise<void> => {
    if (!configured) { setErr(COPY.shareNotConfiguredMsg); return; }
    setBusy(true); setErr(""); setHint("");
    try {
      const r = await sendToBackground<Record<string, never>, {
        loggedIn: boolean; userId: number; displayName: string; email: string; nonce: string;
        quota?: {
          active: number; maxActive: number; hourlyUsed: number; maxHourly: number;
          lifetimeUsed: number; freeLimit: number; hasLicense: boolean;
        };
      }>(MK.CheckShareAuth, {});
      if (!r.loggedIn) {
        setErr(COPY.shareSignedOutMsg);
        setQuota(null);
      } else {
        // Patch already persisted by SW — refresh local view via parent.
        onPatch({
          userId: r.userId, displayName: r.displayName,
          email: r.email, nonce: r.nonce,
          signedInAtIso: new Date().toISOString(),
        });
        if (r.quota) setQuota({
          lifetimeUsed: r.quota.lifetimeUsed,
          freeLimit: r.quota.freeLimit,
          hasLicense: r.quota.hasLicense,
        });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const onSignOut = (): void => {
    onPatch({ userId: 0, displayName: "", email: "", nonce: "", signedInAtIso: "" });
    setQuota(null);
  };

  // Re-fetch quota whenever signed-in state changes, the panel becomes
  // visible again, or the window regains focus — so a license flip from
  // Stripe Checkout / Customer Portal is reflected without a manual
  // sign-out + sign-in cycle.
  useEffect(() => {
    if (!signedIn) return;
    let isAborted = false;
    const refresh = async () => {
      try {
        const r = await sendToBackground<Record<string, never>, {
          loggedIn: boolean;
          quota?: {
            active: number; maxActive: number; hourlyUsed: number; maxHourly: number;
            lifetimeUsed: number; freeLimit: number; hasLicense: boolean;
          };
        }>(MK.CheckShareAuth, {});
        if (!isAborted && r.loggedIn && r.quota) {
          setQuota({
            lifetimeUsed: r.quota.lifetimeUsed,
            freeLimit: r.quota.freeLimit,
            hasLicense: r.quota.hasLicense,
          });
        }
      } catch { /* ignore */ }
    };
    refresh();
    if (typeof window === "undefined") return () => { isAborted = true; };
    const onFocus = () => { void refresh(); };
    const onVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) void refresh();
    };
    window.addEventListener("focus", onFocus);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    const onBillingChanged = () => { void refresh(); };
    window.addEventListener(BILLING_CHANGED_EVENT, onBillingChanged);
    return () => {
      isAborted = true;
      window.removeEventListener("focus", onFocus);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      window.removeEventListener(BILLING_CHANGED_EVENT, onBillingChanged);
    };
  }, [signedIn]);

  return (
    <details className="lpe-settings" open>
      <summary>{COPY.shareSettingsHeader}</summary>
      <div className="lpe-settings-body">
        {!configured ? (
          <div className="lpe-debug-note" role="status">
            {COPY.shareNotConfiguredMsg}
          </div>
        ) : signedIn ? (
          <div className="lpe-field">
            <div>
              {COPY.shareSignedInAsPrefix}{" "}
              <strong>{settings.displayName || settings.email}</strong>
            </div>
            <BillingPanel signedIn={signedIn} />
            {quota && (
              <div className="lpe-debug-note" role="status">
                {quota.hasLicense
                  ? COPY.shareQuotaUnlimited
                  : `${COPY.shareQuotaPrefix} ${quota.lifetimeUsed} / ${quota.freeLimit}`}
                {!quota.hasLicense && quota.freeLimit > 0 && (
                  <div
                    className="lpe-quota-bar"
                    role="progressbar"
                    aria-label={COPY.shareQuotaPrefix}
                    aria-valuemin={0}
                    aria-valuemax={quota.freeLimit}
                    aria-valuenow={Math.min(quota.lifetimeUsed, quota.freeLimit)}
                  >
                    <div
                      className="lpe-quota-bar-fill"
                      data-state={
                        quota.lifetimeUsed >= quota.freeLimit
                          ? "exhausted"
                          : quota.lifetimeUsed >= quota.freeLimit - 1
                          ? "warning"
                          : "ok"
                      }
                      style={{
                        width: `${Math.min(100, Math.round(
                          (quota.lifetimeUsed / quota.freeLimit) * 100,
                        ))}%`,
                      }}
                    />
                  </div>
                )}
                {quota.hasLicense && (
                  <div style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      className="lpe-btn"
                      onClick={async () => {
                        emitBilling("portal_clicked", "settings");
                        try {
                          const { url } = await startBillingPortal({ getShareSettings });
                          if (typeof window !== "undefined" && url) {
                            emitBilling("portal_opened", "settings");
                            window.open(url, "_blank", "noopener,noreferrer");
                          }
                        } catch (err) {
                          emitBilling("portal_failed", "settings", {
                            reason: err instanceof Error ? err.message : String(err),
                          });
                          if (typeof window !== "undefined") {
                            window.open(
                              INSPECT_PAGE_PRICING_URL,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        }
                      }}
                    >
                      {COPY.shareManageSubscriptionBtn}
                    </button>
                  </div>
                )}
                {!quota.hasLicense && quota.lifetimeUsed >= quota.freeLimit && (
                  <div style={{ marginTop: 4 }}>
                    <em>{COPY.shareUpgradeHint}</em>{" "}
                    <button
                      type="button"
                      className="lpe-btn lpe-btn-primary"
                      onClick={async () => {
                        emitBilling("upgrade_clicked", "settings", {
                          freeUsed: quota.lifetimeUsed,
                          freeLimit: quota.freeLimit,
                        });
                        try {
                          const { url } = await startBillingCheckout({ getShareSettings });
                          if (typeof window !== "undefined" && url) {
                            emitBilling("checkout_opened", "settings");
                            window.open(url, "_blank", "noopener,noreferrer");
                            pollBillingUntilPro({ getShareSettings });
                          }
                        } catch (err) {
                          emitBilling("checkout_failed", "settings", {
                            reason: err instanceof Error ? err.message : String(err),
                          });
                          // Fall back to the static pricing page if checkout
                          // is not configured / network fails.
                          if (typeof window !== "undefined") {
                            window.open(
                              INSPECT_PAGE_PRICING_URL,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        }
                      }}
                    >
                      {COPY.shareUpgradeBtn}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button type="button" className="lpe-btn" onClick={onSignOut}>
              {COPY.shareSignOutBtn}
            </button>
          </div>
        ) : (
          <div className="lpe-field">
            <button type="button" className="lpe-btn lpe-btn-primary" onClick={onSignIn}>
              {COPY.shareSignInBtn}
            </button>
            <button type="button" className="lpe-btn" onClick={onRefresh} disabled={busy}>
              {busy ? "…" : COPY.shareCheckBtn}
            </button>
          </div>
        )}
        {hint && <div className="lpe-debug-note">{hint}</div>}
        {err && <div className="lpe-debug-note" role="alert">{err}</div>}
        <div className="lpe-debug-note">{COPY.shareHelp}</div>
        {signedIn && <RecentSharesList />}
      </div>
    </details>
  );
}

function RecentSharesList(): JSX.Element {
  const [items, setItems] = useState<ShareSessionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const rows = await listShareSessions({ getShareSettings });
      setItems(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Refresh on focus so newly-created shares (and incremented views)
  // appear without manual interaction.
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const onRevoke = async (sid: string): Promise<void> => {
    setRevoking(sid); setErr("");
    try {
      await revokeShareSession(sid, { getShareSettings, setShareSettings });
      setItems((prev) => prev?.filter((r) => r.sessionId !== sid) ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setRevoking(null); }
  };

  return (
    <div className="lpe-recent-shares">
      <div className="lpe-recent-header">
        <strong>Recent shares</strong>
        <button type="button" className="lpe-btn" onClick={refresh} disabled={busy}>
          {busy ? "…" : "Refresh"}
        </button>
      </div>
      {err && <div className="lpe-debug-note" role="alert">{err}</div>}
      {items && items.length === 0 && (
        <div className="lpe-debug-note">No shares yet.</div>
      )}
      {items && items.length > 0 && (
        <ul className="lpe-recent-list">
          {items.slice(0, 8).map((r) => {
            const isActive = r.status.toLowerCase() === "active";
            const expiresMs = Date.parse(r.expiresAtIso);
            const expired = Number.isFinite(expiresMs) && expiresMs <= Date.now();
            let host = r.sourceUrl;
            try { host = new URL(r.sourceUrl).hostname.replace(/^www\./, ""); } catch { /* keep */ }
            return (
              <li key={r.sessionId} className="lpe-recent-row">
                {r.urls.image ? (
                  <img
                    src={r.urls.image}
                    alt=""
                    loading="lazy"
                    className="lpe-share-thumb"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="lpe-share-thumb lpe-share-thumb-empty" aria-hidden="true">{r.kind?.[0]?.toUpperCase() ?? "?"}</span>
                )}
                <div className="lpe-recent-meta">
                  <span className="lpe-recent-host" title={r.sourceUrl}>{host}</span>
                  <span className="lpe-recent-kind">{r.kind}</span>
                  <span className="lpe-recent-status" data-expired={expired || !isActive}>
                    {expired ? "Expired" : r.status}
                  </span>
                  <button
                    type="button"
                    className="lpe-views-badge"
                    onClick={() => setExpanded((cur) => (cur === r.sessionId ? null : r.sessionId))}
                    title={`html ${r.perFile.html} · css ${r.perFile.css} · js ${r.perFile.js} · image ${r.perFile.image}`}
                    aria-expanded={expanded === r.sessionId}
                  >
                    <span aria-hidden="true">👁</span> {r.views}
                  </button>
                </div>
                {expanded === r.sessionId && (
                  <div className="lpe-views-breakdown" role="region" aria-label="Per-file views">
                    <span><b>html</b> {r.perFile.html}</span>
                    <span><b>css</b> {r.perFile.css}</span>
                    <span><b>js</b> {r.perFile.js}</span>
                    <span><b>image</b> {r.perFile.image}</span>
                    {r.lastViewedAtIso && (
                      <span className="lpe-views-last">
                        last viewed {new Date(r.lastViewedAtIso).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {isActive && !expired && (
                  <button
                    type="button"
                    className="lpe-btn"
                    onClick={() => onRevoke(r.sessionId)}
                    disabled={revoking === r.sessionId}
                  >
                    {revoking === r.sessionId ? "…" : "Revoke"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export interface ShareDialogProps {
  result: CreateShareSessionResponse;
  onClose: () => void;
}

export function ShareDialog({ result, onClose }: ShareDialogProps): JSX.Element {
  const expiresAtMs = useMemo(() => {
    const t = Date.parse(result.expiresAt);
    return Number.isFinite(t) ? t : Date.now();
  }, [result.expiresAt]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, expiresAtMs - now);
  const expired = remainingMs === 0;

  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [revokeErr, setRevokeErr] = useState("");
  const [copiedKey, setCopiedKey] = useState<string>("");

  const block = useMemo(() => interpolateAi({
    htmlRef: result.urls.html, cssRef: result.urls.css,
    jsRef: result.urls.js, imageRef: result.urls.image,
  }), [result]);

  const copy = useCallback(async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); }
    catch { /* ignore */ }
    window.setTimeout(() => setCopiedKey((k) => (k === key ? "" : k)), 1500);
  }, []);

  const onRevoke = useCallback(async () => {
    setRevoking(true); setRevokeErr("");
    try {
      await sendToBackground<{ sessionId: string }, void>(
        MK.RevokeShareSession, { sessionId: result.sessionId },
      );
      setRevoked(true);
    } catch (e) {
      setRevokeErr(e instanceof Error ? e.message : String(e));
    } finally { setRevoking(false); }
  }, [result.sessionId]);

  const rows: Array<{ key: keyof CreateShareSessionResponse["urls"]; label: string }> = [
    { key: "html",  label: COPY.shareLblHtml },
    { key: "css",   label: COPY.shareLblCss },
    { key: "js",    label: COPY.shareLblJs },
    { key: "image", label: COPY.shareLblImage },
  ];

  return (
    <div className="lpe-modal-overlay" role="dialog" aria-modal="true" aria-label={COPY.shareDialogHeader}>
      <div className="lpe-modal">
        <div className="lpe-modal-header">
          <span className="lpe-debug-title">{COPY.shareDialogHeader}</span>
          <button type="button" className="lpe-header-btn" onClick={onClose} aria-label={COPY.shareCloseBtn}>✕</button>
        </div>
        <div className="lpe-modal-body">
          <div className="lpe-debug-note" style={{ background: "transparent" }}>
            {COPY.shareDialogIntro}
          </div>
          <div className="lpe-share-countdown" data-expired={expired ? "true" : "false"}>
            {expired
              ? COPY.shareExpiredMsg
              : `${COPY.shareExpiresInPrefix} ${formatRemaining(remainingMs)}`}
          </div>
          {revoked && <div className="lpe-debug-note" role="status">{COPY.shareRevokedMsg}</div>}
          <ul className="lpe-share-urls">
            {rows.map(({ key, label }) => (
              <li key={key} className="lpe-share-url-row">
                <span className="lpe-share-url-label">{label}</span>
                <input
                  className="lpe-input lpe-share-url-input"
                  readOnly
                  value={result.urls[key]}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="lpe-btn"
                  onClick={() => copy(result.urls[key], key)}
                  disabled={revoked || expired}
                >
                  {copiedKey === key ? COPY.shareCopyOneDone : COPY.shareCopyOne}
                </button>
              </li>
            ))}
          </ul>
          <div className="lpe-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="lpe-btn lpe-btn-primary"
              onClick={() => copy(block, "all")}
              disabled={revoked || expired}
            >
              {copiedKey === "all" ? COPY.shareCopyAllDone : COPY.shareCopyAll}
            </button>
            <button
              type="button"
              className="lpe-btn"
              onClick={onRevoke}
              disabled={revoking || revoked || expired}
            >
              {revoking ? COPY.shareRevokingMsg : COPY.shareRevokeBtn}
            </button>
            <button type="button" className="lpe-btn" onClick={onClose}>
              {COPY.shareCloseBtn}
            </button>
          </div>
          {revokeErr && <div className="lpe-debug-note" role="alert">{revokeErr}</div>}
        </div>
      </div>
    </div>
  );
}

export function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${m}m ${pad(s)}s`;
}