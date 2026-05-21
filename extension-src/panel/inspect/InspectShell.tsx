/**
 * Inspect Mode root pane. As phases land, this composes Overview (A3),
 * Typography (A4), Colors (A5/A5b), Contrast Scanner (A6), CSS Information
 * (A7), Element Inspector (A8), Distance guides (A8b) and Show Code (A9).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "@shared/copy";
import { format } from "../format";
import { MessageKind } from "@shared/enums";
import { sendToBackground } from "@shared/messaging";
import type { CollectInspectSnapshotResponse } from "@shared/types";
import type { InspectSnapshot } from "../../inspect/types";
import { asInspectSnapshot } from "@shared/narrow";
import { InspectOverview } from "./InspectOverview";
import { InspectTypography } from "./InspectTypography";
import { InspectColors } from "./InspectColors";
import { InspectContrast } from "./InspectContrast";
import { InspectCssInfo } from "./InspectCssInfo";
import { InspectInspector } from "./InspectInspector";
import { InspectTextTypography } from "./InspectTextTypography";
import { ExportMenu } from "./ExportMenu";
import { snapshotCache } from "./snapshot-cache";

interface SnapshotState {
  status: "idle" | "loading" | "ready" | "error";
  snapshot?: InspectSnapshot;
  thumbnailDataUrl?: string;
  error?: string;
}

/**
 * Module-scoped cache: keeps the most recent snapshot so re-opening the
 * Inspect tab paints instantly. Bounded to a single entry — we only ever
 * care about the active tab.
 */
// Module-scoped cache is delegated to `snapshotCache` so other surfaces
// (e.g. ExportModes) can read the same snapshot without re-collection.

function scheduleIdle(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") {
    ric(fn, { timeout: 200 });
  } else {
    setTimeout(fn, 0);
  }
}

export function InspectShell(): JSX.Element {
  // Seed from module cache so re-opening the tab paints immediately.
  const [state, setState] = useState<SnapshotState>(() => {
    const cache = snapshotCache.get();
    if (cache) {
      return {
        status: "ready",
        snapshot: asInspectSnapshot(cache.data.snapshot),
        thumbnailDataUrl: cache.data.thumbnailDataUrl,
      };
    }
    return { status: "loading" };
  });
  const aliveRef = useRef(true);

  const load = useCallback(async (force = false) => {
    const cached = snapshotCache.get();
    if (!force && cached) {
      setState({
        status: "ready",
        snapshot: asInspectSnapshot(cached.data.snapshot),
        thumbnailDataUrl: cached.data.thumbnailDataUrl,
      });
      return;
    }
    setState({ status: "loading" });
    try {
      const res = await sendToBackground<{ tabId: number }, CollectInspectSnapshotResponse>(
        MessageKind.CollectInspectSnapshot, { tabId: -1 },
      );
      snapshotCache.set({ key: "_", data: res });
      if (!aliveRef.current) return;
      setState({
        status: "ready",
        snapshot: asInspectSnapshot(res.snapshot),
        thumbnailDataUrl: res.thumbnailDataUrl,
      });
    } catch (e) {
      if (!aliveRef.current) return;
      setState({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    // Defer the heavy snapshot collection so the skeleton paints first.
    if (!snapshotCache.get()) scheduleIdle(() => { void load(); });
    return () => { aliveRef.current = false; };
  }, [load]);

  return (
    <div className="lpe-inspect-shell" role="region" aria-label={COPY.inspectModeTitle}>
      {state.status === "ready" && state.snapshot && (
        <header className="lpe-inspect-shell-header">
          <ExportMenu snapshot={state.snapshot} />
          <button
            type="button"
            className="lpe-btn"
            onClick={() => void load(true)}
            title={COPY.inspectRetry}
            style={{ width: "auto", padding: "4px 10px", fontSize: 12 }}
          >↻</button>
        </header>
      )}
      {state.status === "loading" && (
        <div className="lpe-inspect-skeleton" aria-busy="true" aria-live="polite">
          <span className="lpe-inspect-skeleton-label">{COPY.inspectLoading}</span>
          <div className="lpe-skel lpe-skel-block" />
          <div className="lpe-skel lpe-skel-line" style={{ width: "70%" }} />
          <div className="lpe-skel lpe-skel-line" style={{ width: "55%" }} />
          <div className="lpe-skel lpe-skel-block" />
          <div className="lpe-skel lpe-skel-line" style={{ width: "80%" }} />
        </div>
      )}
      {state.status === "error" && (
        <div className="lpe-inspect-empty">
          <strong>{COPY.inspectError}</strong>
          <span>{state.error}</span>
          <button type="button" className="lpe-btn" onClick={() => void load(true)}>
            {COPY.inspectRetry}
          </button>
        </div>
      )}
      {state.status === "ready" && state.snapshot && (
        <>
          <InspectOverview
            snapshot={state.snapshot}
            thumbnailDataUrl={state.thumbnailDataUrl ?? ""}
          />
          <InspectTypography snapshot={state.snapshot} />
          <InspectColors snapshot={state.snapshot} />
          <InspectContrast snapshot={state.snapshot} />
          <InspectCssInfo snapshot={state.snapshot} />
          <InspectInspector snapshot={state.snapshot} />
          <InspectTextTypography snapshot={state.snapshot} />
          <footer className="lpe-inspect-footer">
            <span>{format(COPY.inspectFooterLabel, { version: "2.5.0" })}</span>
          </footer>
        </>
      )}
    </div>
  );
}