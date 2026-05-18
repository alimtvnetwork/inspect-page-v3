/**
 * "What's new in v2.6" block — surfaces the latest Stripe billing,
 * popup-UX and Inspect-tab polish on top of the original Smart Share base.
 */
import { CreditCard, Sparkles, Gauge, LayoutPanelTop, PartyPopper, ShieldCheck } from "lucide-react";

const ITEMS = [
  { icon: CreditCard, title: "Stripe billing", body: "Upgrade to Pro from the popup — Stripe Checkout + Customer Portal wired end-to-end, license flips via signed webhook." },
  { icon: PartyPopper, title: "Pricing card + Pro toast", body: "Settings shows a pricing card with 4 Pro feature bullets, and a \u201cYou\u2019re Pro \ud83c\udf89\u201d toast pops the moment Checkout completes." },
  { icon: LayoutPanelTop, title: "Full-overlay Settings", body: "Settings now covers the popup edge-to-edge in a fixed 380\u00d7580 window \u2014 no peeking export UI, no clipped scrollbars." },
  { icon: Gauge, title: "Instant Inspect tab", body: "Shimmer skeleton paints on the first frame, heavy snapshot work runs in requestIdleCallback, and reopening the tab paints instantly from cache." },
  { icon: Sparkles, title: "Recent-visitors drawer", body: "Pro accounts get an opt-in drawer in WP admin showing per-asset views with anonymised IP/UA hashes \u2014 useful for share-link analytics." },
  { icon: ShieldCheck, title: "Direct sign-in", body: "Onboarding and signed-out Share Links now open the WP login bridge directly \u2014 no detour through Settings." },
];

export const WhatsNew = (): JSX.Element => (
  <section aria-labelledby="whats-new" className="space-y-6">
    <div className="flex items-baseline gap-3">
      <h2 id="whats-new" className="text-2xl font-semibold tracking-tight">
        What&rsquo;s new
      </h2>
      <span
        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        aria-label="Version 2.6"
      >
        v2.6
      </span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {ITEMS.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex gap-3 rounded-lg border border-border/60 p-4">
          <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <div className="text-sm font-medium">{title}</div>
            <div className="text-sm text-muted-foreground">{body}</div>
          </div>
        </div>
      ))}
    </div>
    <p className="text-xs text-muted-foreground">
      Full details in{" "}
      <a
        href="https://github.com/lovable-dev/inspect-page/blob/main/CHANGELOG.md"
        className="underline underline-offset-2 hover:text-foreground"
        target="_blank"
        rel="noreferrer"
      >
        CHANGELOG.md
      </a>
      .
    </p>
  </section>
);
