/**
 * Default values for settings and panel position.
 * Source: spec/21-app/16-storage-schema.md.
 */
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_JPEG_QUALITY,
  DEFAULT_NAME_ELEMENT_TEMPLATE,
  DEFAULT_NAME_FULLPAGE_TEMPLATE,
} from "./constants";
import type { Settings, PanelPosition, StorageRoot } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  imageFormat: DEFAULT_IMAGE_FORMAT,
  jpegQuality: DEFAULT_JPEG_QUALITY,
  namingTemplateFullPage: DEFAULT_NAME_FULLPAGE_TEMPLATE,
  namingTemplateElement: DEFAULT_NAME_ELEMENT_TEMPLATE,
  redactPasswordFields: true,
  includeComputedStyles: true,
  includeMatchedRules: true,
  panelEnabledByDefault: false,
};

export const DEFAULT_PANEL_POSITION: PanelPosition = {
  xPx: 16,
  yPx: 16,
  minimized: false,
};

export function buildDefaultStorageRoot(): StorageRoot {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    panelPosition: { ...DEFAULT_PANEL_POSITION },
  };
}
