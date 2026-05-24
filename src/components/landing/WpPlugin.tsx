import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, Server } from "lucide-react";
import { downloadStaticFile } from "@/lib/downloadStaticFile";

const WP_ZIP_URL = "/inspect-page-wp.zip";
const WP_ZIP_SIZE_KB = 52;

export const WpPlugin = (): JSX.Element => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownload = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await downloadStaticFile(WP_ZIP_URL, "inspect-page-wp.zip");
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
        public URLs (HTML, CSS, JS, preview) that expire after 24 hours, so you can
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
          WordPress 6.4+ · PHP 8.1+ · {WP_ZIP_SIZE_KB} KB
        </span>
      </div>
      <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
        <li>Upload the unzipped <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">inspect-page</code> folder to <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">wp-content/plugins/</code> and activate it.</li>
        <li>In the extension, open <strong>Settings → Smart Share</strong>. The backend URL is baked in — just click <strong>Sign in</strong>. A WordPress login tab opens.</li>
        <li>Sign in to WordPress as usual. The extension picks up the cookie + nonce automatically — no tokens or app passwords to copy.</li>
      </ol>
      <p className="text-sm text-muted-foreground">
        Optional: copy <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">mu-plugin/inspect-page-branding.php</code> to{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">wp-content/mu-plugins/</code> to theme the login page with Inspect Page branding.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
};
