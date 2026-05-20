/**
 * "What's new in v2.7.5" block — surfaces the Color Tokens v2 milestone on
 * top of the v2.7 Team Workspaces baseline.
 */
import { Palette, FileCode2, Pencil, Users, Mail, ShieldCheck } from "lucide-react";

const ITEMS = [
  { icon: Palette, title: "Color Tokens v2", body: "Every detected color is emitted as a token with tint / base / shade variants (\u00b112% lightness) so designers get a ready-to-use 3-stop palette per hue." },
  { icon: FileCode2, title: "tokens.css + selectors.css", body: "MD+files and ZIP downloads now drop two extra files: a `:root { --ip-color-N }` block and per-selector rules using `var(--ip-color-N)`. Smart Share bakes the same CSS into its hosted pages." },
  { icon: Pencil, title: "Per-selector custom CSS", body: "Inspect \u2192 Colors \u2192 Tokens lets you rename any token and attach arbitrary CSS declarations to any selector. Edits persist per snapshot in chrome.storage.local." },
  { icon: Users, title: "Team Workspaces", body: "Owner / admin / member roles, per-workspace Stripe license, and a Workspace switcher in the popup. Legacy single-seat Pro keeps working." },
  { icon: Mail, title: "Email invites", body: "Invite teammates by email \u2014 64-hex single-use tokens, 7-day TTL, accepted from a hidden WP admin landing page." },
  { icon: ShieldCheck, title: "Backwards-compat billing", body: "Existing Pro users are auto-migrated into a solo workspace, and the webhook keeps legacy user-meta in parallel during the transition." },
];

export const WhatsNew = (): JSX.Element => (
  <section aria-labelledby="whats-new" className="space-y-6">
    <div className="flex items-baseline gap-3">
      <h2 id="whats-new" className="text-2xl font-semibold tracking-tight">
        What&rsquo;s new
      </h2>
      <span
        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        aria-label="Version 2.7.5"
      >
        v2.7.5
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
