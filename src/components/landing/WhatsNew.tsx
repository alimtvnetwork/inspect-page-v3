/**
 * "What's new in v1.1" block — surfaces the v1.1 fidelity pass on the
 * landing page so visitors downloading the zip see what improved since
 * v1.0. Source: CHANGELOG.md §[1.1.0].
 */
const ITEMS: Array<{ title: string; body: string }> = [
  {
    title: "Open shadow DOM",
    body:
      "Web-component-driven sites (Lit, FAST, Spectrum, Ionic, GitHub primer-elements) now round-trip via Declarative Shadow DOM templates.",
  },
  {
    title: "Constructed stylesheets",
    body:
      "adoptedStyleSheets attached to shadow roots or the document are serialized inline so Lit/FAST styling survives the export.",
  },
  {
    title: "Font binary bundling",
    body:
      "@font-face url(...) references are fetched, base64-encoded, and inlined. Exports render with original typography fully offline.",
  },
  {
    title: "Same-origin iframe traversal",
    body:
      "Iframes you can read are recursively serialized into srcdoc; cross-origin frames are tagged so consumers see what was unreachable.",
  },
  {
    title: "In-panel telemetry",
    body:
      "After every export the panel shows what was captured: shadow roots, fonts (with size), iframes, stylesheets, and screenshot tiles.",
  },
];

export const WhatsNew = (): JSX.Element => (
  <section aria-labelledby="whats-new" className="space-y-4">
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
    <p className="text-sm text-muted-foreground">
      The v1.1 fidelity pass focuses on capturing pages exactly as they
      render — including the parts of the platform that older exporters
      drop on the floor.
    </p>
    <ul className="space-y-3">
      {ITEMS.map((it) => (
        <li
          key={it.title}
          className="rounded-md border border-border/60 bg-card/40 p-3"
        >
          <div className="text-sm font-medium text-foreground">{it.title}</div>
          <div className="mt-1 text-sm text-foreground/80">{it.body}</div>
        </li>
      ))}
    </ul>
    <p className="text-xs text-muted-foreground">
      Full details in{" "}
      <a
        href="https://github.com/lovable-dev/llm-export/blob/main/CHANGELOG.md"
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