import { FileCode2, Image as ImageIcon, FileJson, FileText } from "lucide-react";

const FILES = [
  {
    icon: FileCode2,
    name: "page.html · styles.css · scripts.js",
    body: "Source, merged stylesheets, and readable scripts.",
  },
  {
    icon: ImageIcon,
    name: "screenshot.png",
    body: "Full-page capture, sticky-aware.",
  },
  {
    icon: FileJson,
    name: "manifest.json",
    body: "Capture metadata: viewport, DPR, counts, version.",
  },
  {
    icon: FileText,
    name: "element.md",
    body: "Element export: outerHTML, matched CSS, two screenshots.",
  },
];

export const WhatYouGet = (): JSX.Element => (
  <section aria-labelledby="what-you-get" className="space-y-6">
    <h2 id="what-you-get" className="text-2xl font-semibold tracking-tight">
      What you get
    </h2>
    <div className="grid gap-3 sm:grid-cols-2">
      {FILES.map(({ icon: Icon, name, body }) => (
        <div
          key={name}
          className="flex gap-3 rounded-lg border border-border/60 p-4"
        >
          <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <div className="font-mono text-xs">{name}</div>
            <div className="text-sm text-muted-foreground">{body}</div>
          </div>
        </div>
      ))}
    </div>
  </section>
);