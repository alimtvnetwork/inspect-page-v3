/**
 * Phase A6 — Contrast Scanner.
 *
 * Home row: count of failing pairs + "Show all" link → opens detail screen
 * with Failing/Passing segmented tabs, then a card per pair with ratio,
 * verdict, "{N} instances", expandable swatches + AA/AAA grid.
 */
import { useMemo, useState } from "react";
import { COPY } from "@shared/copy";
import { format } from "../format";
import { computeContrastPairs, type ContrastPair } from "../../inspect/contrast";
import type { InspectSnapshot } from "../../inspect/types";

export interface InspectContrastProps { snapshot: InspectSnapshot }

export function InspectContrast({ snapshot }: InspectContrastProps): JSX.Element {
  const pairs = useMemo(() => computeContrastPairs(snapshot.textNodes), [snapshot.textNodes]);
  const failing = pairs.filter((p) => failsAA(p));
  const passing = pairs.filter((p) => !failsAA(p));
  const [open, setOpen] = useState(false);

  return (
    <section className="lpe-contrast" aria-label={COPY.inspectContrastTitle}>
      <header className="lpe-section-header">
        <h2 className="lpe-section-title">{COPY.inspectContrastTitle}</h2>
        {pairs.length > 0 && (
          <button type="button" className="lpe-link" onClick={() => setOpen(true)}>
            {COPY.inspectContrastShowAll}
          </button>
        )}
      </header>

      {pairs.length === 0 ? (
        <div className="lpe-inspect-empty"><span>{COPY.inspectContrastNone}</span></div>
      ) : (
        <div className="lpe-contrast-summary">
          <span className="lpe-contrast-badge lpe-contrast-badge-fail">
            {failing.length} fail
          </span>
          <span className="lpe-contrast-badge lpe-contrast-badge-pass">
            {passing.length} pass
          </span>
        </div>
      )}

      {open && (
        <ContrastDetail
          failing={failing}
          passing={passing}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function failsAA(p: ContrastPair): boolean {
  return p.isLarge ? !p.verdict.largeAA : !p.verdict.normalAA;
}

/* -------------------- Detail screen -------------------- */

interface ContrastDetailProps {
  failing: ContrastPair[];
  passing: ContrastPair[];
  onClose: () => void;
}

function ContrastDetail({ failing, passing, onClose }: ContrastDetailProps): JSX.Element {
  const [tab, setTab] = useState<"failing" | "passing">("failing");
  const list = tab === "failing" ? failing : passing;

  return (
    <div className="lpe-modal-backdrop" role="dialog" aria-modal="true">
      <div className="lpe-modal lpe-modal-wide">
        <header className="lpe-modal-header">
          <button
            type="button" className="lpe-header-btn"
            onClick={onClose}
            aria-label={COPY.inspectContrastBack}
            title={COPY.inspectContrastBack}
          >←</button>
          <h3>{COPY.inspectContrastTitle}</h3>
          <span style={{ flex: 1 }} />
          <button
            type="button" className="lpe-header-btn"
            onClick={onClose} aria-label={COPY.inspectClose}
          >✕</button>
        </header>

        <div className="lpe-subtabs" style={{ margin: "8px 12px 0" }} role="tablist">
          <button
            type="button" role="tab" aria-selected={tab === "failing"}
            className="lpe-subtab" data-active={tab === "failing" ? "true" : "false"}
            onClick={() => setTab("failing")}
          >
            {COPY.inspectContrastFailing} ({failing.length})
          </button>
          <button
            type="button" role="tab" aria-selected={tab === "passing"}
            className="lpe-subtab" data-active={tab === "passing" ? "true" : "false"}
            onClick={() => setTab("passing")}
          >
            {COPY.inspectContrastPassing} ({passing.length})
          </button>
        </div>

        <div className="lpe-modal-body">
          {list.length === 0 ? (
            <div className="lpe-inspect-empty"><span>—</span></div>
          ) : (
            list.map((p, i) => <PairCard key={`${p.fg}-${p.bg}-${p.isLarge}-${i}`} pair={p} />)
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Pair card -------------------- */

function PairCard({ pair }: { pair: ContrastPair }): JSX.Element {
  const [open, setOpen] = useState(false);
  const { ratio, verdict: v, isLarge } = pair;
  return (
    <div className="lpe-pair-card">
      <div className="lpe-pair-head">
        <div className="lpe-pair-preview" style={{ background: pair.bg, color: pair.fg }}>
          Aa
        </div>
        <div className="lpe-pair-stats">
          <div className="lpe-pair-ratio">{ratio.toFixed(2)}</div>
          <div className={`lpe-pair-verdict lpe-pair-verdict-${v.label.toLowerCase()}`}>
            {v.label} · {isLarge ? COPY.inspectContrastLarge : COPY.inspectContrastNormal}
          </div>
          <div className="lpe-pair-instances">
            {format(COPY.inspectContrastInstances, { n: pair.instances })}
          </div>
        </div>
        <button
          type="button" className="lpe-link"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? COPY.inspectContrastHideDetails : COPY.inspectContrastShowDetails}
        </button>
      </div>

      {open && (
        <div className="lpe-pair-details">
          <div className="lpe-pair-swatches">
            <Swatch label={COPY.inspectContrastText} value={pair.fg} />
            <Swatch label={COPY.inspectContrastBackground} value={pair.bg} />
          </div>
          <AAGrid v={v} />
        </div>
      )}
    </div>
  );
}

function Swatch({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="lpe-pair-swatch">
      <span className="lpe-pair-swatch-label">{label}</span>
      <div className="lpe-pair-swatch-row">
        <span className="lpe-color-swatch" style={{ background: value }} aria-hidden="true" />
        <span className="lpe-color-hex">{value}</span>
      </div>
    </div>
  );
}

function AAGrid({ v }: { v: ReturnType<typeof import("../../inspect/contrast").verdict> }): JSX.Element {
  return (
    <table className="lpe-aa-grid">
      <thead>
        <tr>
          <th></th>
          <th>AA</th>
          <th>AAA</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">{COPY.inspectContrastNormal}</th>
          <td><Pill ok={v.normalAA} /></td>
          <td><Pill ok={v.normalAAA} /></td>
        </tr>
        <tr>
          <th scope="row">{COPY.inspectContrastLarge}</th>
          <td><Pill ok={v.largeAA} /></td>
          <td><Pill ok={v.largeAAA} /></td>
        </tr>
      </tbody>
    </table>
  );
}

function Pill({ ok }: { ok: boolean }): JSX.Element {
  return (
    <span className={`lpe-aa-pill ${ok ? "is-pass" : "is-fail"}`}>
      {ok ? "Pass" : "Fail"}
    </span>
  );
}