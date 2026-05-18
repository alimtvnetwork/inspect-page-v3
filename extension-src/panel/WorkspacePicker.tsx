/**
 * Phase W7 — WorkspacePicker modal for the popup.
 *
 * Replaces the bare <select> with a chip → dialog that surfaces role +
 * license status per workspace and links out to the WP admin
 * "Inspect Page Workspaces" page for management.
 *
 * Pure presentation: parent owns selection state. Closes on Esc / overlay
 * click. Renders nothing if `workspaces` is empty.
 */
import { useEffect, useRef, type JSX } from "react";
import { useState } from "react";
import { COPY } from "@shared/copy";
import type { WorkspaceListItem } from "../share/listWorkspaces";
import { normalizeBaseUrl } from "@shared/shareSettings";

export interface WorkspacePickerProps {
  workspaces: WorkspaceListItem[];
  value: number | undefined;
  onChange: (id: number) => void;
  /** WP site URL — used to deep-link to the Workspaces admin page. */
  siteUrl: string;
}

function roleLabel(role: WorkspaceListItem["role"]): string {
  if (role === "owner") return COPY.workspaceRoleOwner;
  if (role === "admin") return COPY.workspaceRoleAdmin;
  return COPY.workspaceRoleMember;
}

function licenseLabel(s: WorkspaceListItem["licenseStatus"]): string {
  if (s === "active") return COPY.workspaceLicenseActive;
  if (s === "past_due") return COPY.workspaceLicensePastDue;
  if (s === "canceled") return COPY.workspaceLicenseCanceled;
  return COPY.workspaceLicenseFree;
}

export function WorkspacePicker(props: WorkspacePickerProps): JSX.Element | null {
  const { workspaces, value, onChange, siteUrl } = props;
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (workspaces.length === 0) return null;
  const active = workspaces.find((w) => w.id === value) ?? workspaces[0];
  const manageHref = siteUrl
    ? `${normalizeBaseUrl(siteUrl)}/wp-admin/admin.php?page=inspect-page-workspaces`
    : null;

  return (
    <>
      <button
        type="button"
        className="lpe-ws-chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={COPY.workspacePickerOpen}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lpe-ws-chip-name">{active.name || `#${active.id}`}</span>
        <span className="lpe-ws-chip-badge" data-license={active.licenseStatus}>
          {licenseLabel(active.licenseStatus)}
        </span>
        <span aria-hidden="true" className="lpe-ws-chip-caret">▾</span>
      </button>
      {open && (
        <div
          className="lpe-ws-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={COPY.workspacePickerTitle}
            className="lpe-ws-dialog"
          >
            <div className="lpe-ws-dialog-header">
              <strong>{COPY.workspacePickerTitle}</strong>
              <button
                type="button"
                className="lpe-ws-dialog-close"
                aria-label={COPY.workspacePickerClose}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <ul className="lpe-ws-list" role="listbox" aria-label={COPY.workspacePickerTitle}>
              {workspaces.map((w) => {
                const isActive = w.id === active.id;
                return (
                  <li key={w.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className="lpe-ws-row"
                      data-active={isActive ? "true" : "false"}
                      onClick={() => { onChange(w.id); setOpen(false); }}
                    >
                      <span className="lpe-ws-row-name">
                        {w.name || `#${w.id}`}
                        {isActive && (
                          <span className="lpe-ws-row-current" aria-hidden="true">
                            · {COPY.workspacePickerCurrent}
                          </span>
                        )}
                      </span>
                      <span className="lpe-ws-row-meta">
                        <span className="lpe-ws-chip-badge" data-role={w.role}>
                          {roleLabel(w.role)}
                        </span>
                        <span className="lpe-ws-chip-badge" data-license={w.licenseStatus}>
                          {licenseLabel(w.licenseStatus)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {manageHref && (
              <div className="lpe-ws-dialog-footer">
                <a
                  href={manageHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="lpe-ws-manage"
                >
                  {COPY.workspacePickerManage} ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}