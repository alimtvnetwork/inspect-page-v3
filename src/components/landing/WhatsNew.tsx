/**
 * "What's new in v1.1" block — surfaces the v1.1 fidelity pass on the
 * landing page so visitors downloading the zip see what improved since
 * v1.0. Source: CHANGELOG.md §[1.1.0].
 */
import { Layers, Palette, Type, Frame, BarChart3 } from "lucide-react";

const ITEMS = [
  { icon: Layers, title: "Open shadow DOM", body: "Web-component sites round-trip via declarative templates." },
  { icon: Palette, title: "Constructed stylesheets", body: "adoptedStyleSheets are inlined so styling survives." },
  { icon: Type, title: "Font bundling", body: "@font-face binaries inlined as base64. Renders offline." },
  { icon: Frame, title: "Iframe traversal", body: "Same-origin frames serialized into srcdoc." },
  { icon: BarChart3, title: "Panel telemetry", body: "See exactly what was captured after every export." },
];

export const WhatsNew = (): JSX.Element => (
  <section aria-labelledby="whats-new" className="space-y-6">
    <div className="flex items-baseline gap-3">
      <h2 id="whats-new" className="text-2xl font-semibold tracking-tight">
        What&rsquo;s new
      </h2>
      <span
        className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        aria-label="Version 1.1"
      >
        v1.1
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