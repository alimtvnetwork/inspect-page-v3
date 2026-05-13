/**
 * Inspect Mode root pane. As phases land, this composes Overview (A3),
 * Typography (A4), Colors (A5/A5b), Contrast Scanner (A6), CSS Information
 * (A7), Element Inspector (A8), Distance guides (A8b) and Show Code (A9).
 */
import { useCallback, useEffect, useState } from "react";
import { COPY } from "@shared/copy";
import { INSPECT_PAGE_DOCS_URL } from "@shared/constants";
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { CollectInspectSnapshotResponse } from "@shared/types";
import type { InspectSnapshot } from "../../inspect/types";
import { InspectOverview } from "./InspectOverview";
import { InspectTypography } from "./InspectTypography";

interface SnapshotState {
  status: "idle" | "loading" | "ready" | "error";
  snapshot?: InspectSnapshot;
  thumbnailDataUrl?: string;
  error?: string;
}

export function InspectShell(): JSX.Element {
  const [state, setState] = useState<SnapshotState>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await sendToBackground<{ tabId: number }, CollectInspectSnapshotResponse>(
        MessageKind.CollectInspectSnapshot, { tabId: -1 },
      );
      setState({
        status: "ready",
        snapshot: res.snapshot as InspectSnapshot,
        thumbnailDataUrl: res.thumbnailDataUrl,
      });
    } catch (e) {
      setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onOpenDocs = useCallback(() => {
    try { window.open(INSPECT_PAGE_DOCS_URL, "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
  }, []);

  return (
    <div className="lpe-inspect-shell" role="region" aria-label={COPY.inspectModeTitle}>
      {state.status === "loading" && (
        <div className="lpe-inspect-empty"><span>{COPY.inspectLoading}</span></div>
      )}
      {state.status === "error" && (
        <div className="lpe-inspect-empty">
          <strong>{COPY.inspectError}</strong>
          <span>{state.error}</span>
          <button type="button" className="lpe-btn" onClick={() => void load()}>
            {COPY.inspectRetry}
          </button>
        </div>
      )}
      {state.status === "ready" && state.snapshot && (
        <>
          <InspectOverview
            snapshot={state.snapshot}
            thumbnailDataUrl={state.thumbnailDataUrl ?? ""}
            onOpenDocs={onOpenDocs}
          />
          <InspectTypography snapshot={state.snapshot} />
        </>
      )}
    </div>
  );
}