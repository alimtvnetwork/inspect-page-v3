import { Globe, PanelTop, MousePointerSquareDashed } from "lucide-react";

const STEPS = [
  { icon: Globe, title: "Open any site", body: "No setup, no allow-list." },
  { icon: PanelTop, title: "Open the panel", body: "Toolbar popup or floating panel." },
  {
    icon: MousePointerSquareDashed,
    title: "Full Page or Pick Element",
    body: "One click. Files land in Downloads.",
  },
];

export const HowItWorks = (): JSX.Element => (
  <section aria-labelledby="how-it-works" className="space-y-6">
    <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
      How it works
    </h2>
    <div className="grid gap-4 sm:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        <div key={title} className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            <span className="font-mono text-xs text-muted-foreground">
              0{i + 1}
            </span>
          </div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{body}</div>
        </div>
      ))}
    </div>
  </section>
);