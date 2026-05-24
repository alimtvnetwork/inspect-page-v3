/**
 * Distribution landing page for the Inspect Page Chrome extension.
 * Source: spec/21-app/18-distribution-page.md.
 */
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
const ZIP_SIZE_KB = 325;
const VERSION = "2.7.9";

const Index = (): JSX.Element => {
  document.title = "Inspect Page — Chrome extension";

  // JSON-LD SoftwareApplication for SEO.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Inspect Page",
    applicationCategory: "BrowserApplication",
    operatingSystem: "Chromium",
    description:
      "Export any webpage as HTML, CSS, JS and a full-page screenshot, ready for your LLM.",
    softwareVersion: VERSION,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-[720px] px-5 py-12 sm:py-16 space-y-20">
        <Hero zipUrl={ZIP_URL} version={VERSION} sizeKb={ZIP_SIZE_KB} />
        <HowItWorks />
        <InstallSteps />
        <WhatYouGet />
        <WhatsNew />
        <WpPlugin />
        <Pricing />
        <Faq />
        <Privacy />
      </main>
      <Footer version={VERSION} />
    </div>
  );
};

export default Index;