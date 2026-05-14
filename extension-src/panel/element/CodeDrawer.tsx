/**
 * C5 — Code preview drawer.
 *
 * Slides up over the inspector and shows the picked element's matched CSS
 * (Base / Hover / Focus / Active / Disabled tabs) plus grouped computed-style
 * diff (Layout, Typography, Background, Border, Effects, Other). Read-only
 * with a copy-to-clipboard button per pane.
 */
import { useCallback, useMemo, useState } from "react";
import type { ElementSnapshot } from "@element/collectElementSnapshot";

export interface CodeDrawerProps {
  snapshot: ElementSnapshot;
  onClose: () => void;
}

type StateTab = "base" | "hover" | "focus" | "active" | "disabled";
type GroupTab = "layout" | "typography" | "background" | "border" | "effects" | "other";

export function CodeDrawer({ snapshot, onClose }: CodeDrawerProps): JSX.Element {
  const [stateTab, setStateTab] = useState<StateTab>("base");
  const [groupTab, setGroupTab] = useState<GroupTab>("layout");

  const matchedCss = snapshot.matched[stateTab] || "/* no rules */";
  const groupCss = useMemo(
    () => formatGroup(snapshot.groupedDiff[groupTab]),
    [snapshot, groupTab],
  );

  const copy = useCallback(async (v: string) => {
    try { await navigator.clipboard.writeText(v); } catch { /* ignore */ }
  }, []);

  return (
    <div className="lpe-cdr" role="dialog" aria-label="Element code">
      <div className="lpe-cdr-header">
        <span className="lpe-cdr-title">Code</span>
        <span className="lpe-spacer" />
        <button type="button" className="lpe-header-btn" onClick={onClose} aria-label="Close">×</button>
      </div>

      <section className="lpe-cdr-section">
        <div className="lpe-cdr-tabs" role="tablist" aria-label="State">
          {(["base","hover","focus","active","disabled"] as StateTab[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={stateTab === s}
              className={`lpe-cdr-tab ${stateTab === s ? "is-active" : ""}`}
              onClick={() => setStateTab(s)}
            >{s}</button>
          ))}
          <span className="lpe-spacer" />
          <button
            type="button" className="lpe-cdr-copy"
            onClick={() => copy(matchedCss)}
            aria-label="Copy matched CSS"
          >Copy</button>
        </div>
        <pre className="lpe-cdr-pre"><code>{matchedCss}</code></pre>
      </section>

      <section className="lpe-cdr-section">
        <div className="lpe-cdr-tabs" role="tablist" aria-label="Computed group">
          {(["layout","typography","background","border","effects","other"] as GroupTab[]).map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={groupTab === g}
              className={`lpe-cdr-tab ${groupTab === g ? "is-active" : ""}`}
              onClick={() => setGroupTab(g)}
            >{g}</button>
          ))}
          <span className="lpe-spacer" />
          <button
            type="button" className="lpe-cdr-copy"
            onClick={() => copy(groupCss)}
            aria-label="Copy computed styles"
          >Copy</button>
        </div>
        <pre className="lpe-cdr-pre"><code>{groupCss}</code></pre>
      </section>
    </div>
  );
}

function formatGroup(group: Record<string, string>): string {
  const keys = Object.keys(group).sort();
  if (keys.length === 0) return "/* no overrides */";
  return keys.map((k) => `${k}: ${group[k]};`).join("\n");
}