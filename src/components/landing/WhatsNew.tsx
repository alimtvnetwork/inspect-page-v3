/**
 * "What's new in v2.7.9" block — surfaces the dark-mint theme restore, picker
 * stability fix, and Export panel UX polish on top of the v2.7 baseline.
 */
import { Palette, MousePointerClick, LayoutPanelTop, Sparkles, Users, ShieldCheck } from "lucide-react";

const ITEMS = [
  { icon: Palette, title: "Dark-mint theme restored", body: "Locked the extension popup + floating panel to the approved dark-mint palette (#2DD4A8 on #0B0F0E). Legacy amber/gold/orange presets removed; custom accents are now constrained to cool greens, teals, and blues." },
  { icon: MousePointerClick, title: "Picker no longer disappears", body: "Clicking a non-pickable area (iframes, blank space, the panel itself) keeps the picker active and shows a tiny \u201cNot pickable \u2014 try another element\u201d hint instead of collapsing to a lone Cancel bar." },
  { icon: LayoutPanelTop, title: "Export tab shows everything", body: "Re-download and Export for AI groups render fully expanded by default. Buttons stay visible in a ghost/disabled state with an inline hint before the first capture \u2014 no more hidden options." },
  { icon: Sparkles, title: "Hover + spacing polish", body: "Fixed black-on-black hover states on secondary buttons, tightened the Export header so the Format toggle no longer overlaps the title, and softened the disabled Share Links button." },
  { icon: Users, title: "Team Workspaces", body: "Owner / admin / member roles, per-workspace Stripe license, and a Workspace switcher in the popup. Legacy single-seat Pro keeps working." },
  { icon: ShieldCheck, title: "Backwards-compat billing", body: "Existing Pro users stay in a solo workspace, and the webhook keeps legacy user-meta in parallel during the transition." },
];

export const WhatsNew = (): JSX.Element => (
  <section aria-labelledby="whats-new" className="space-y-6">
    <div className="flex items-baseline gap-3">
      <h2 id="whats-new" className="text-2xl font-semibold tracking-tight">
        What&rsquo;s new
      </h2>
      <span
        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        aria-label="Version 2.7.9"
      >
        v2.7.9
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
