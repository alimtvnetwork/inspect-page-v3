/**
 * Settings & storage types. Split from shared/types.ts (S2).
 */
export type ImageFormat = "png" | "jpeg";

export interface Settings {
  imageFormat: ImageFormat;
  jpegQuality: number;
  namingTemplateFullPage: string;
  namingTemplateElement: string;
  redactPasswordFields: boolean;
  includeComputedStyles: boolean;
  includeMatchedRules: boolean;
  panelEnabledByDefault: boolean;
}

export interface PanelPosition {
  xPx: number;
  yPx: number;
  minimized: boolean;
  /** Persisted floating-panel size (Phase A12). Optional for backward compat. */
  wPx?: number;
  hPx?: number;
}

export interface LastExportRecord {
  kind: "fullPage" | "element";
  filename: string;
  downloadId: number;
  finishedAtIso: string;
}

export interface StorageRoot {
  schemaVersion: 1;
  settings: Settings;
  panelPosition: PanelPosition;
  lastExport?: LastExportRecord;
}