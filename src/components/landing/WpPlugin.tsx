import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Server } from "lucide-react";

const WP_ZIP_URL = "/inspect-page-wp.zip";

export const WpPlugin = (): JSX.Element => {
  const [loading, setLoading] = useState(false);
  const [sizeKb, setSizeKb] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(WP_ZIP_URL, { method: "HEAD" });
        if (!res.ok || cancelled) return;
        const len = res.headers.get("content-length");
        if (len) setSizeKb(Math.round(parseInt(len, 10) / 1024));
      } catch {
        // landing still renders
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(WP_ZIP_URL);
      if (!res.ok) {
        setError(`Download failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inspect-page-wp.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast({ title: "Downloaded inspect-page-wp.zip" });
    } catch (e) {
      setError(`Download failed: ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby="wp-plugin" className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <Server className="h-5 w-5 text-primary" aria-hidden />
        <h2 id="wp-plugin" className="text-2xl font-semibold tracking-tight">
          WordPress plugin (optional)
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Self-host the Smart Share backend on your own WordPress site. Generates four
        public URLs (HTML, CSS, JS, screenshot) that expire after 24 hours, so you can
        paste them straight into ChatGPT, Claude, or Gemini.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={loading}
          className="w-full sm:w-auto"
          aria-label="Download WordPress plugin ZIP"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 h-4 w-4" aria-hidden />
          )}
          Download WP plugin
        </Button>
        <span className="text-sm text-muted-foreground">
          WordPress 6.4+ · PHP 8.1+
          {sizeKb !== null ? ` · ${sizeKb} KB` : ""}
        </span>
      </div>
      <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
        <li>Upload the unzipped <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">inspect-page</code> folder to <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">wp-content/plugins/</code> and activate it.</li>
        <li>In the extension, open <strong>Settings → Smart Share (WordPress)</strong>, paste your site URL, and click <strong>Sign in</strong>. A WordPress login tab opens.</li>
        <li>Sign in to WordPress as usual. The extension picks up the cookie + nonce automatically — no tokens or app passwords to copy.</li>
      </ol>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
};