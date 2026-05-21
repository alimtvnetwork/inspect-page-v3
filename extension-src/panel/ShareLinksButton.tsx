/**
 * ShareLinksButton — sign-in CTA or "Share via WordPress" trigger.
 * Extracted from ExportPanel.tsx (B1 r10).
 */
import { COPY } from "@shared/copy";
import type { ShareSettings, ExportArtifacts } from "@shared/types";

export interface ShareLinksButtonProps {
  shareSettings: ShareSettings | null;
  hasArtifacts: boolean;
  busy: boolean;
  artifacts: ExportArtifacts | null;
  onShare: (artifacts: ExportArtifacts) => Promise<void>;
  onSignIn: () => void;
}

export function ShareLinksButton(props: ShareLinksButtonProps): JSX.Element {
  const { shareSettings, hasArtifacts, busy, artifacts, onShare, onSignIn } = props;
  const signedIn = !!shareSettings && !!shareSettings.nonce && !!shareSettings.siteUrl;
  if (!signedIn) {
    return (
      <button
        type="button"
        className="lpe-btn"
        onClick={onSignIn}
        disabled={busy}
        title={COPY.shareSignInBtn}
      >
        {COPY.shareSignInBtn} — {COPY.exportModeShare}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="lpe-btn"
      onClick={() => { if (artifacts) void onShare(artifacts); }}
      disabled={busy || !hasArtifacts || !artifacts}
      title={hasArtifacts ? COPY.exportModeShare : "Run export first"}
    >
      {COPY.exportModeShare}
    </button>
  );
}