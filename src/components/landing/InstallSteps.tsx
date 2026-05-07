import type { ReactNode } from "react";
import { Download, FolderOpen, ToggleRight, Upload, FolderInput } from "lucide-react";

const STEPS: Array<{ icon: typeof Download; title: string; body: ReactNode }> = [
  { icon: Download, title: "Download & unzip", body: "Grab the ZIP above and extract it somewhere you'll keep." },
  {
    icon: FolderOpen,
    title: "Open extensions",
    body: (
      <>
        Visit{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          chrome://extensions
        </code>
        .
      </>
    ),
  },
  { icon: ToggleRight, title: "Developer mode", body: "Toggle it on in the top-right corner." },
  { icon: Upload, title: "Load unpacked", body: "Click the button in the toolbar." },
  { icon: FolderInput, title: "Pick the folder", body: "Select the unzipped folder. Done." },
];

export const InstallSteps = (): JSX.Element => (
  <section aria-labelledby="install" className="space-y-6">
    <h2 id="install" className="text-2xl font-semibold tracking-tight">
      Install
    </h2>
    <p className="text-sm text-muted-foreground">
      Sideload via Load unpacked — works in Chrome, Edge, Brave, and Arc.
    </p>
    <ol className="space-y-4">
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        <li key={title} className="flex gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card">
            <Icon className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <div className="flex-1 space-y-1 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Step {i + 1}
              </span>
              <span className="text-sm font-medium">{title}</span>
            </div>
            <div className="text-sm text-muted-foreground">{body}</div>
          </div>
        </li>
      ))}
    </ol>
  </section>
);