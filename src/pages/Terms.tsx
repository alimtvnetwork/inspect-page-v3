/**
 * Public terms of service. Linked from Chrome Web Store listing and the
 * landing footer. Plain-language MIT-style terms — keep concise.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";

const Terms = (): JSX.Element => {
  useEffect(() => {
    document.title = "Terms — Inspect Page";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "Terms of service for the Inspect Page Chrome extension and Smart Share backend.";
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
          <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: 13 May 2026</p>
        </header>

        <section className="space-y-3">
          <p className="text-base text-muted-foreground">
            By installing or using the Inspect Page Chrome extension and the optional
            Smart Share WordPress backend (together, the "Service"), you agree to these
            Terms. If you do not agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">1. The Service</h2>
          <p className="text-base text-muted-foreground">
            Inspect Page captures the active browser tab into HTML, CSS, JS, and a
            screenshot for personal review or sharing with AI tools. Smart Share is an
            optional feature that uploads a capture to a WordPress site you connect to,
            making four short-lived public URLs valid for 24 hours.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">2. Acceptable use</h2>
          <ul className="list-disc pl-5 text-base text-muted-foreground space-y-1">
            <li>You only capture pages you have a right to view and share.</li>
            <li>You do not use the Service to harvest credentials, payment data, or
                personal data of other people.</li>
            <li>You do not use the Service to violate copyright, trademarks, or any
                applicable law.</li>
            <li>You do not abuse Smart Share quotas, attempt to bypass rate limits, or
                disrupt the WordPress backend.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">3. Free + Pro plans</h2>
          <p className="text-base text-muted-foreground">
            The extension is free. Smart Share includes 5 free lifetime uploads per
            WordPress account. Pro unlocks unlimited uploads. Pricing and entitlements
            may change with notice on this page; existing licenses remain honored for
            their current billing period.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">4. No warranty</h2>
          <p className="text-base text-muted-foreground">
            The Service is provided "as is" and "as available" without warranties of any
            kind, express or implied, including merchantability, fitness for a
            particular purpose, and non-infringement. Captures may be incomplete on
            pages with aggressive anti-scraping, dynamic content, or cross-origin
            iframes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">5. Limitation of liability</h2>
          <p className="text-base text-muted-foreground">
            To the maximum extent permitted by law, Inspect Page and its contributors
            are not liable for any indirect, incidental, consequential, or punitive
            damages arising out of your use of the Service. Total liability for any
            claim is capped at the amount you paid for the Service in the 12 months
            preceding the claim (which may be zero).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">6. Termination</h2>
          <p className="text-base text-muted-foreground">
            You may stop using the Service at any time by uninstalling the extension and
            removing the WordPress plugin. We may suspend accounts that violate these
            Terms or that abuse Smart Share quotas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">7. Changes</h2>
          <p className="text-base text-muted-foreground">
            We may revise these Terms. The "Last updated" date will reflect any change.
            Continued use after a change means you accept the revised Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">8. Contact</h2>
          <p className="text-base text-muted-foreground">
            Open an issue at the repository linked from the Chrome Web Store listing.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Terms;