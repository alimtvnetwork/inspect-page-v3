/**
 * Barrel re-export for shared types. Split into domain modules (S2):
 * - `./types/settings` — Settings, PanelPosition, StorageRoot
 * - `./types/export`   — ExportMeta, DomRect, ExportArtifacts, ColorTokenExportAddons
 * - `./types/messaging`— Wire envelopes + per-message payload/response types
 * - `./types/share`    — Smart Share (WP plugin) types
 *
 * Importers should continue to use `shared/types` — this barrel keeps the
 * public surface stable so the split is non-breaking.
 */
export * from "./types/settings";
export * from "./types/export";
export * from "./types/messaging";
export * from "./types/share";