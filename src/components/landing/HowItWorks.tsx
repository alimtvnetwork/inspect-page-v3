export const HowItWorks = (): JSX.Element => (
  <section aria-labelledby="how-it-works" className="space-y-4">
    <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
      How it works
    </h2>
    <ol className="space-y-3 list-decimal list-inside text-foreground/90 marker:text-muted-foreground">
      <li>Open any site.</li>
      <li>Open the extension popup or the floating panel.</li>
      <li>
        Choose <strong className="font-semibold">Full Page</strong> or{" "}
        <strong className="font-semibold">Pick Element</strong>.
      </li>
    </ol>
  </section>
);