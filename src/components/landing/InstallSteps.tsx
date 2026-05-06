export const InstallSteps = (): JSX.Element => (
  <section aria-labelledby="install" className="space-y-4">
    <h2 id="install" className="text-2xl font-semibold tracking-tight">
      Install (Load unpacked)
    </h2>
    <ol className="space-y-3 list-decimal list-inside text-foreground/90 marker:text-muted-foreground">
      <li>Download the ZIP and unzip it.</li>
      <li>
        Open{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
          chrome://extensions
        </code>
        .
      </li>
      <li>Toggle “Developer mode” (top-right).</li>
      <li>Click “Load unpacked”.</li>
      <li>Select the unzipped folder.</li>
    </ol>
  </section>
);