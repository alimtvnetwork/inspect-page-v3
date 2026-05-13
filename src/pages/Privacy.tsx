/**
 * Public privacy policy. Linked from the Chrome Web Store listing form
 * and from the landing footer. Mirrors `store/privacy.md`.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";

const Privacy = (): JSX.Element => {
  useEffect(() => {
    document.title = "Privacy — Inspect Page";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "Inspect Page runs locally. No telemetry, analytics, or remote configuration. Read the full policy.";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-[720px] px-5 py-12 sm:py-16 space-y-8">
        <nav className="text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Inspect Page
          </Link>
        </nav>
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: 10 May 2026</p>
        </header>

        <section className="space-y-3">
          <p className="text-base text-muted-foreground">
            Inspect Page is a Chrome extension that captures the page in the active tab into a
            downloadable bundle. This policy describes what data the extension touches and
            what it does (and does not) do with it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Summary</h2>
          <ul className="list-disc pl-5 text-base text-muted-foreground space-y-1">
            <li>Inspect Page runs entirely on your machine.</li>
            <li>We do not operate any server. No telemetry, analytics, or crash reports.</li>
            <li>We do not sell, share, or transfer any data.</li>
            <li>
              The only network requests the extension initiates are stylesheets and scripts
              the page already references, and — only if you enable Smart Share — a single
              upload to the WordPress site you point it at.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Data we touch</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-3 font-medium">Data</th>
                  <th className="p-3 font-medium">Stored where</th>
                  <th className="p-3 font-medium">Sent anywhere?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="p-3">Your settings</td><td className="p-3"><code className="font-mono text-xs">chrome.storage.local</code></td><td className="p-3">No</td></tr>
                <tr><td className="p-3">Floating-panel position</td><td className="p-3"><code className="font-mono text-xs">chrome.storage.local</code></td><td className="p-3">No</td></tr>
                <tr><td className="p-3">WordPress site URL + cached display name / cookie nonce (Smart Share only)</td><td className="p-3"><code className="font-mono text-xs">chrome.storage.local</code></td><td className="p-3">Only to the site URL you entered, over HTTPS. No passwords or tokens are stored.</td></tr>
                <tr><td className="p-3">Page HTML / CSS / JS being exported</td><td className="p-3">RAM during export</td><td className="p-3">Saved to your Downloads only (or your WP if you choose Smart Share)</td></tr>
                <tr><td className="p-3">Screenshot pixels</td><td className="p-3">RAM (<code className="font-mono text-xs">OffscreenCanvas</code>)</td><td className="p-3">Same as above</td></tr>
                <tr><td className="p-3">Logs</td><td className="p-3">DevTools console</td><td className="p-3">Never sent</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Password redaction</h2>
          <p className="text-base text-muted-foreground">
            Password redaction is on by default. Every <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">&lt;input type=&quot;password&quot;&gt;</code>{" "}
            in the captured HTML is serialized with an empty value before any file is
            written. We do not attempt to redact other secret-shaped fields (autofill
            credit cards, OTPs, JWTs). Always review your export before sharing it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Smart Share (optional)</h2>
          <p className="text-base text-muted-foreground">
            If you install the companion WordPress plugin and sign in via the popup
            launched from Inspect Page's Settings, the Smart Share export uploads the
            captured HTML, CSS, JS, and screenshot to your WordPress site and returns
            four short public URLs valid for 24 hours. Authentication uses your existing
            WordPress login cookie plus a short-lived REST nonce — no passwords or
            tokens are saved. After 24 hours an hourly cron job on your site deletes
            the files and marks the session expired. You can revoke any session earlier
            from the share dialog or from <strong>Tools → Inspect Page Sessions</strong> in
            WordPress admin. We do not operate the WordPress site — you do.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Children</h2>
          <p className="text-base text-muted-foreground">
            Inspect Page is not directed at children under 13 and does not knowingly collect
            data from anyone.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Changes</h2>
          <p className="text-base text-muted-foreground">
            If we change this policy we will update the "Last updated" date and publish
            the new version at the same URL. Substantive changes will be called out in
            the extension's "What's new" section.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Contact</h2>
          <p className="text-base text-muted-foreground">
            Open an issue at the repository linked from the Chrome Web Store listing.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Privacy;