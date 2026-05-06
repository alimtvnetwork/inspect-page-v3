export const WhatYouGet = (): JSX.Element => (
  <section aria-labelledby="what-you-get" className="space-y-4">
    <h2 id="what-you-get" className="text-2xl font-semibold tracking-tight">
      What you get
    </h2>
    <ul className="space-y-2 list-disc list-inside text-foreground/90 marker:text-muted-foreground">
      <li>
        <code className="font-mono text-sm">page.html</code> /{" "}
        <code className="font-mono text-sm">styles.css</code> /{" "}
        <code className="font-mono text-sm">scripts.js</code>
      </li>
      <li>
        <code className="font-mono text-sm">screenshot.png</code> (full page)
      </li>
      <li>
        <code className="font-mono text-sm">manifest.json</code> (capture metadata)
      </li>
      <li>Element export → single .md file</li>
    </ul>
  </section>
);