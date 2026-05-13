/**
 * Distribution landing page for the Inspect Page Chrome extension.
 * Source: spec/21-app/18-distribution-page.md.
 */
import { useEffect, useState } from "react";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InstallSteps } from "@/components/landing/InstallSteps";
import { WhatYouGet } from "@/components/landing/WhatYouGet";
import { WhatsNew } from "@/components/landing/WhatsNew";
import { Privacy } from "@/components/landing/Privacy";
import { WpPlugin } from "@/components/landing/WpPlugin";
import { Footer } from "@/components/landing/Footer";
import { Pricing } from "@/components/landing/Pricing";
import { Faq } from "@/components/landing/Faq";

const ZIP_URL = "/inspect-page.zip";

const Index = (): JSX.Element => {
  const [meta, setMeta] = useState<{ version: string; sizeKb: number | null }>({
    version: "2.0.0",
    sizeKb: null,
  });

  useEffect(() => {
    document.title = "Inspect Page — Chrome extension";
    // Best-effort metadata fetch (HEAD). If the build is missing, we keep
    // sizeKb=null and the Hero hides the size pill.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(ZIP_URL, { method: "HEAD" });
        if (!res.ok) return;
        const len = res.headers.get("content-length");
        if (cancelled || !len) return;
        setMeta((m) => ({ ...m, sizeKb: Math.round(parseInt(len, 10) / 1024) }));
      } catch {
        // Ignore — landing still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // JSON-LD SoftwareApplication for SEO.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Inspect Page",
    applicationCategory: "BrowserApplication",
    operatingSystem: "Chromium",
    description:
      "Export any webpage as HTML, CSS, JS and a full-page screenshot, ready for your LLM.",
    softwareVersion: meta.version,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-[720px] px-5 py-12 sm:py-16 space-y-20">
        <Hero zipUrl={ZIP_URL} version={meta.version} sizeKb={meta.sizeKb} />
        <HowItWorks />
        <InstallSteps />
        <WhatYouGet />
        <WhatsNew />
        <WpPlugin />
        <Pricing />
        <Faq />
        <Privacy />
      </main>
      <Footer version={meta.version} />
    </div>
  );
};

export default Index;