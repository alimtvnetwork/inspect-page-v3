/**
 * Phase A11 — Snapshot-wide Export menu in the Inspect Mode header.
 *
 * Renders a "Export report ▾" link that toggles a small dropdown with
 * 4 actions: JSON, Markdown, Colors CSV, Fonts CSV. Each action calls
 * the pure serializers in `inspect/exportSnapshot.ts` and triggers a
 * download via `downloadText`.
 */
import { useEffect, useRef, useState } from "react";
import { COPY } from "@shared/copy";
import type { InspectSnapshot } from "../../inspect/types";
import {
  toJson, toMarkdown, colorsToCsv, fontsToCsv,
  safeBaseName, mimeFor,
} from "../../inspect/exportSnapshot";
import { downloadText } from "./downloadBlob";

export interface ExportMenuProps { snapshot: InspectSnapshot }

export function ExportMenu({ snapshot }: ExportMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const base = safeBaseName(snapshot);

  const exports: Array<{ label: string; run: () => void }> = [
    {
      label: COPY.inspectExportJson,
      run: () => {
        const { mime, ext } = mimeFor("json");
        downloadText(toJson(snapshot), `${base}.${ext}`, mime);
      },
    },
    {
      label: COPY.inspectExportMarkdown,
      run: () => {
        const { mime, ext } = mimeFor("md");
        downloadText(toMarkdown(snapshot), `${base}.${ext}`, mime);
      },
    },
    {
      label: COPY.inspectExportColorsCsv,
      run: () => {
        const { mime, ext } = mimeFor("csv");
        downloadText(colorsToCsv(snapshot.colors), `${base}-colors.${ext}`, mime);
      },
    },
    {
      label: COPY.inspectExportFontsCsv,
      run: () => {
        const { mime, ext } = mimeFor("csv");
        downloadText(fontsToCsv(snapshot.fonts), `${base}-fonts.${ext}`, mime);
      },
    },
  ];

  return (
    <div className="lpe-export-menu" ref={ref}>
      <button
        type="button" className="lpe-link"
        aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {COPY.inspectExportReport} ▾
      </button>
      {open && (
        <ul className="lpe-export-menu-pop" role="menu">
          {exports.map((e) => (
            <li key={e.label}>
              <button
                type="button" role="menuitem" className="lpe-export-menu-item"
                onClick={() => { e.run(); setOpen(false); }}
              >
                {e.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}