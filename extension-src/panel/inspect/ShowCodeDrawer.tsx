/**
 * Phase A9 — Show Code drawer.
 *
 * Modal that renders an HTML/CSS snippet synthesized from a single
 * {@link ComputedSample}, with subtab + Copy. Reuses `lpe-modal-*`.
 */
import { useMemo, useState, useEffect, useCallback } from "react";
import { COPY } from "@shared/copy";
import type { ComputedSample } from "../../inspect/types";
import { synthesizeCode } from "../../inspect/synthesize-code";

export interface ShowCodeDrawerProps {
  sample: ComputedSample;
  onClose(): void;
}

export function ShowCodeDrawer({ sample, onClose }: ShowCodeDrawerProps): JSX.Element {
  const code = useMemo(() => synthesizeCode(sample), [sample]);
  const [tab, setTab] = useState<"html" | "css">("html");
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    const text = tab === "html" ? code.html : code.css;
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }, [tab, code]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lpe-modal-backdrop" role="dialog" aria-modal="true" aria-label={COPY.inspectShowCodeTitle} onClick={onClose}>
      <div className="lpe-modal lpe-modal-code" onClick={(e) => e.stopPropagation()}>
        <div className="lpe-modal-header">
          <h3>{COPY.inspectShowCodeTitle} — <span className="lpe-modal-code-selector">{sample.selector}</span></h3>
          <button type="button" className="lpe-btn" onClick={onClose} aria-label={COPY.inspectClose}>{COPY.inspectClose}</button>
        </div>
        <div className="lpe-modal-body">
          <div className="lpe-subtabs" role="tablist" aria-label="Code view">
            <button
              type="button" role="tab" className="lpe-subtab"
              aria-selected={tab === "html"}
              data-active={tab === "html" ? "true" : "false"}
              onClick={() => setTab("html")}
            >{COPY.inspectShowCodeTabHtml}</button>
            <button
              type="button" role="tab" className="lpe-subtab"
              aria-selected={tab === "css"}
              data-active={tab === "css" ? "true" : "false"}
              onClick={() => setTab("css")}
            >{COPY.inspectShowCodeTabCss}</button>
          </div>
          <pre className="lpe-modal-code-pre"><code>{tab === "html" ? code.html : code.css}</code></pre>
          <div className="lpe-modal-code-footer">
            <button type="button" className="lpe-btn" onClick={() => void onCopy()}>
              {copied ? COPY.inspectShowCodeCopied : COPY.inspectShowCodeCopy}
            </button>
            <span className="lpe-modal-code-note">{COPY.inspectShowCodeNote}</span>
          </div>
        </div>
      </div>
    </div>
  );
}