import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download } from "lucide-react";

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
      // Defer revoke so the browser can pick up the download.
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast({ title: "Downloaded inspect-page.zip" });
    } catch (e) {
      setError(`Download failed: ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="space-y-6">
      <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
        v2.2 · WordPress Smart Share
      </span>
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
        Export any web page for your LLM
      </h1>
      <p className="text-lg text-muted-foreground">
        HTML, CSS, JavaScript and a full-page screenshot — bundled in one ZIP.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          size="lg"
          onClick={handleDownload}
          disabled={loading}
          className="w-full sm:w-auto"
          aria-label="Download extension ZIP"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 h-4 w-4" aria-hidden />
          )}
          Download extension
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