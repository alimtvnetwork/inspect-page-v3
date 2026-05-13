import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const FREE_FEATURES = [
  "Export any page as HTML + CSS + JS + screenshot",
  "Pick Element mode for single-component capture",
  "5 Smart Share links (lifetime)",
  "Self-hosted WordPress backend",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited Smart Share links",
  "Links expire after 24h — re-share anytime",
  "Priority support",
];

export const Pricing = (): JSX.Element => (
  <section aria-labelledby="pricing" className="space-y-6">
    <h2 id="pricing" className="text-2xl font-semibold tracking-tight">
      Pricing
    </h2>
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Free */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Free</h3>
          <p className="text-sm text-muted-foreground">
            Forever. No credit card required.
          </p>
        </div>
        <div className="text-3xl font-bold tracking-tight">$0</div>
        <ul className="space-y-2">
          {FREE_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pro */}
      <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-6 space-y-4">
        <div className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          <Sparkles className="h-3 w-3" aria-hidden />
          Coming soon
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Pro</h3>
          <p className="text-sm text-muted-foreground">
            For power users and teams.
          </p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight">$5</span>
          <span className="text-sm text-muted-foreground">/ month</span>
        </div>
        <ul className="space-y-2">
          {PRO_FEATURES.map((f) => (
            <li key={f} className="flex gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <Button disabled className="w-full" variant="default">
          Upgrade to Pro
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Billing & checkout landing in a future update.
        </p>
      </div>
    </div>
  </section>
);
