/**
 * "What's new in v2.7" block — surfaces Team Workspaces on top of the
 * v2.6 Stripe billing + popup-UX foundation.
 */
import { Users, Mail, KeyRound, CreditCard, LayoutPanelTop, ShieldCheck } from "lucide-react";

const ITEMS = [
  { icon: Users, title: "Team Workspaces", body: "Create shared workspaces with owner / admin / member roles \u2014 one Pro license covers every member, share quotas pool together." },
  { icon: Mail, title: "Email invites", body: "Owners and admins invite teammates by email; single-use 7-day tokens land in their inbox and drop them straight into the workspace on accept." },
  { icon: CreditCard, title: "Per-workspace billing", body: "Stripe Checkout and the Customer Portal now attach to the active workspace \u2014 switch workspace, switch subscription." },
  { icon: LayoutPanelTop, title: "Workspace picker in popup", body: "Tap the workspace chip in the popup header to switch workspaces, see role + license badges, or jump to WP admin to manage members." },
  { icon: KeyRound, title: "Transfer ownership", body: "Owners can hand the keys to another admin without losing history \u2014 the new owner inherits the Stripe customer and member list." },
  { icon: ShieldCheck, title: "Backwards-compatible", body: "Existing solo users are auto-migrated into a personal workspace on plugin update \u2014 nothing to reconnect, every old share link keeps working." },
];

export const WhatsNew = (): JSX.Element => (
  <section aria-labelledby="whats-new" className="space-y-6">
    <div className="flex items-baseline gap-3">
      <h2 id="whats-new" className="text-2xl font-semibold tracking-tight">
        What&rsquo;s new
      </h2>
      <span
        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        aria-label="Version 2.7"
      >
        v2.7
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
