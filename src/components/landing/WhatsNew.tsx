/**
 * "What's new in v2.2" block — surfaces the v2.2 Smart Share features.
 */
import { Share2, Timer, Globe, ShieldCheck, Zap } from "lucide-react";

const ITEMS = [
  { icon: Share2, title: "Smart Share", body: "Upload captures to your WordPress backend and get 4 public URLs — HTML, CSS, JS, and a live preview." },
  { icon: Timer, title: "24-hour expiry", body: "Share links auto-delete after 24 hours. No clutter, no long-term hosting risk." },
  { icon: Globe, title: "Self-hosted backend", body: "Your own WordPress site hosts the files. You control the data, not a third-party cloud." },
  { icon: ShieldCheck, title: "Cookie + nonce auth", body: "Sign in via the standard WordPress login flow. No API keys, no app passwords to copy." },
  { icon: Zap, title: "Free quota", body: "5 Smart Share sessions for free. Upgrade to Pro for unlimited sharing." },
];

export const WhatsNew = (): JSX.Element => (
  <section aria-labelledby="whats-new" className="space-y-6">
    <div className="flex items-baseline gap-3">
      <h2 id="whats-new" className="text-2xl font-semibold tracking-tight">
        What&rsquo;s new
      </h2>
      <span
        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        aria-label="Version 2.2"
      >
        v2.2
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
