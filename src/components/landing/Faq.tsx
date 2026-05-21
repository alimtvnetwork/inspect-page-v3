import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS = [
  {
    q: "Do I need a WordPress account to use the extension?",
    a: "No. The extension works entirely in your browser — export to ZIP or Markdown without ever signing in. You only need a WordPress account if you want to use Smart Share, which generates 4 public URLs you can paste into ChatGPT, Claude, or Gemini.",
  },
  {
    q: "How does Smart Share work?",
    a: "When you export a page and choose Smart Share, the extension uploads 4 files (HTML, CSS, JS, screenshot) to your WordPress backend. It creates a session folder with 4 public links. Those links expire after 24 hours and are automatically deleted.",
  },
  {
    q: "What happens after 24 hours?",
    a: "The session folder and all its files are deleted by an hourly WordPress cron job. The public URLs return a 404. You can create a new Smart Share anytime (Free users get 5 lifetime shares; Pro users get unlimited).",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Everything runs locally in your browser until you explicitly choose Smart Share. Even then, files live only on your own WordPress server — not on ours. The extension does not send analytics or telemetry anywhere.",
  },
  {
    q: "Which browsers are supported?",
    a: "Chrome, Edge, Brave, Arc, and any Chromium-based browser. Firefox support is planned for a future release.",
  },
  {
    q: "Can I self-host the backend?",
    a: "Absolutely. The WordPress plugin is open-source and included in the download. Install it on any WordPress 6.4+ site with PHP 8.1+ and you have your own backend.",
  },
];

export const Faq = (): JSX.Element => (
  <section aria-labelledby="faq" className="space-y-6">
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: ITEMS.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }),
      }}
    />
    <div className="flex items-center gap-2">
      <HelpCircle className="h-5 w-5 text-primary" aria-hidden />
      <h2 id="faq" className="text-2xl font-semibold tracking-tight">
        Frequently asked questions
      </h2>
    </div>
    <Accordion type="multiple" className="w-full">
      {ITEMS.map(({ q, a }, i) => (
        <AccordionItem value={`faq-${i}`} key={i}>
          <AccordionTrigger className="text-left text-sm font-medium">
            {q}
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            {a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
);
