import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Chrome } from "lucide-react";

interface HeroProps {
  zipUrl: string;
  version: string;
  sizeKb: number | null;
}

export const Hero = ({ zipUrl, version, sizeKb }: HeroProps): JSX.Element => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownload = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(zipUrl);
      if (!res.ok) {
        setError(`Download failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inspect-page.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast({ title: "Downloaded inspect-page.zip" });
    } catch (e) {
      setError(`Download failed: ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="relative space-y-6 isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-20 -top-32 -z-10 h-[420px] blur-3xl opacity-80"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />
        v2.6 · Smart Share · Stripe billing · WordPress backend
      </span>
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
        <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
          Export any web page
        </span>{" "}
        <span className="text-foreground">for your LLM</span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-xl">
        HTML, CSS, JavaScript and a full-page screenshot — bundled in one ZIP.
        Smart Share generates 4 public links that expire after 24 hours.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          size="lg"
          onClick={handleDownload}
          disabled={loading}
          className="w-full sm:w-auto text-primary-foreground border-0 shadow-[var(--shadow-glow)] hover:opacity-95 transition"
          style={{ backgroundImage: "var(--gradient-primary)" }}
          aria-label="Download extension ZIP"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 h-4 w-4" aria-hidden />
          )}
          Download extension
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled
          className="w-full sm:w-auto"
          aria-label="Chrome Web Store (coming soon)"
        >
          <Chrome className="mr-2 h-4 w-4" aria-hidden />
          Chrome Web Store
        </Button>
        <span className="text-sm text-muted-foreground">
          v{version}
          {sizeKb !== null ? ` · ${sizeKb} KB` : ""}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </header>
  );
};