/**
 * Phase A4c — Account section at the bottom of Inspect Mode.
 *
 * Signed out → "Sign in to Inspect Page" (opens the WP login bridge).
 * Signed in  → email + plan badge (Free X/5 or Pro) + Manage subscription
 *              (Pro) or Upgrade to Pro (Free) + Sign out.
 *
 * Pure UI wrapper around the existing share/billing helpers — no new backend.
 */
import { useEffect, useState, useCallback } from "react";
import { MessageKind as MK } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import { INSPECT_PAGE_WP_SITE_URL } from "@shared/constants";
import { getShareSettings, setShareSettings, shareConfigured } from "@shared/share-settings";
import { getBillingStatus, type BillingStatus } from "../../share/get-billing-status";
import { startBillingPortal } from "../../share/start-billing-portal";
import { startBillingCheckout } from "../../share/start-billing-checkout";
import type { ShareSettings } from "@shared/types";

export function InspectAccount(): JSX.Element {
  const [settings, setSettings] = useState<ShareSettings | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const s = await getShareSettings();
      setSettings(s);
      if (shareConfigured(s)) {
        try {
          const b = await getBillingStatus({ getShareSettings });
          setBilling(b);
        } catch { setBilling(null); }
      } else {
        setBilling(null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const onSignIn = async (): Promise<void> => {
    const siteUrl = INSPECT_PAGE_WP_SITE_URL;
    if (!siteUrl) { setMsg("WordPress site URL not configured."); return; }
    setBusy(true);
    try {
      await sendToBackground<{ siteUrl: string }, void>(MK.OpenLoginPopup, { siteUrl });
      setMsg("Sign-in tab opened. Complete login, then come back.");
      // Poll a few times so the account flips to signed-in shortly after login.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const onSignOut = async (): Promise<void> => {
    setBusy(true);
    try {
      await setShareSettings({ userId: 0, displayName: "", email: "", nonce: "", signedInAtIso: "" });
      await refresh();
      setMsg("Signed out.");
    } finally { setBusy(false); }
  };

  const onManage = async (): Promise<void> => {
    setBusy(true);
    try {
      const { url } = await startBillingPortal({ getShareSettings });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const onUpgrade = async (): Promise<void> => {
    setBusy(true);
    try {
      const { url } = await startBillingCheckout({ getShareSettings });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const isSignedIn = !!settings && shareConfigured(settings);
  const isPro = billing?.plan === "pro";

  return (
    <section className="lpe-account" aria-label="Account">
      <header className="lpe-section-header">
        <h2 className="lpe-section-title">Account</h2>
      </header>

      {!isSignedIn && (
        <div className="lpe-account-card">
          <div className="lpe-account-info">
            <div className="lpe-account-name">Not signed in</div>
            <div className="lpe-account-sub">Sign in to your Inspect Page WordPress account.</div>
          </div>
          <button type="button" className="lpe-account-btn lpe-account-primary" onClick={() => void onSignIn()} disabled={busy}>
            Sign in
          </button>
        </div>
      )}

      {isSignedIn && (
        <div className="lpe-account-card">
          <div className="lpe-account-info">
            <div className="lpe-account-name">{settings!.displayName || settings!.email || "Signed in"}</div>
            {settings!.email && settings!.email !== settings!.displayName && (
              <div className="lpe-account-sub">{settings!.email}</div>
            )}
            <div className="lpe-account-badges">
              {isPro && <span className="lpe-account-badge is-pro">Pro · unlimited</span>}
              {!isPro && billing && (
                <span className="lpe-account-badge">
                  Free · {billing.lifetimeUsed}/{billing.freeLimit} used
                </span>
              )}
              {!billing && <span className="lpe-account-badge">Free</span>}
            </div>
          </div>
          <div className="lpe-account-actions">
            {isPro ? (
              <button type="button" className="lpe-account-btn" onClick={() => void onManage()} disabled={busy}>
                Manage subscription
              </button>
            ) : (
              <button type="button" className="lpe-account-btn lpe-account-primary" onClick={() => void onUpgrade()} disabled={busy}>
                Upgrade to Pro
              </button>
            )}
            <button type="button" className="lpe-link lpe-account-signout" onClick={() => void onSignOut()} disabled={busy}>
              Sign out
            </button>
          </div>
        </div>
      )}

      {msg && <div className="lpe-account-msg" role="status">{msg}</div>}
    </section>
  );
}