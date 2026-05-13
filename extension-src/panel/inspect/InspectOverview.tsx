/**
 * Phase A3 — Overview section.
 *
 * Renders the hero card from the page snapshot:
 *   - Visible-viewport thumbnail (single captureVisibleTab in the SW)
 *   - Page title
 *   - URL (truncated, click-to-copy)
 *   - "Open docs" CTA
 *
 * Pure presentation; the snapshot is collected by InspectShell.
 */
import { COPY } from "@shared/copy";
import type { InspectSnapshot } from "../../inspect/types";

export interface InspectOverviewProps {
  snapshot: InspectSnapshot;
  thumbnailDataUrl: string;
  onOpenDocs: () => void;
}

export function InspectOverview(props: InspectOverviewProps): JSX.Element {
  const { snapshot, thumbnailDataUrl, onOpenDocs } = props;
  const { pageInfo } = snapshot;

  return (
    <section className="lpe-overview" aria-label={COPY.inspectOverviewTitle}>
      <header className="lpe-overview-header">
        <h2 className="lpe-overview-title">{COPY.inspectOverviewTitle}</h2>
      </header>

      {thumbnailDataUrl ? (
        <div className="lpe-overview-hero">
          <img
            src={thumbnailDataUrl}
            alt={pageInfo.title || pageInfo.url}
            className="lpe-overview-thumb"
          />
        </div>
      ) : (
        <div className="lpe-overview-hero lpe-overview-hero-empty" aria-hidden="true" />
      )}

      <div className="lpe-overview-meta">
        <div className="lpe-overview-page-title" title={pageInfo.title}>
          {pageInfo.title || pageInfo.origin}
        </div>
        <a
          className="lpe-overview-url"
          href={pageInfo.url}
          target="_blank"
          rel="noopener noreferrer"
          title={pageInfo.url}
        >
          {pageInfo.url}
        </a>
      </div>

      <button type="button" className="lpe-btn" onClick={onOpenDocs}>
        {COPY.inspectOpenDocs}
      </button>
    </section>
  );
}