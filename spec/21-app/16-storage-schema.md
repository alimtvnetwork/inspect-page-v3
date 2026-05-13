# 16 — Storage schema (`chrome.storage.local`)

Single root key: `inspect-page`. Atomic writes only — read, mutate locally, write whole object back.

## Shape (TypeScript)

```ts
type StorageRoot = {
  schemaVersion: 1;
  settings: Settings;
  panelPosition: PanelPosition;
  lastExport?: LastExportRecord;
};

type Settings = {
  imageFormat: 'png' | 'jpeg';     // default 'png'
  jpegQuality: number;             // 60..100, default 90, ignored when png
  namingTemplateFullPage: string;  // default see 07-file-naming.md
  namingTemplateElement: string;   // default see 07-file-naming.md
  redactPasswordFields: boolean;   // default true (see 21-security-privacy.md)
  includeComputedStyles: boolean;  // default true
  includeMatchedRules: boolean;    // default true
  panelEnabledByDefault: boolean;  // default false (popup-only until requested)
};

type PanelPosition = {
  xPx: number;       // clamp 0..(innerWidth - PANEL_MIN_W)
  yPx: number;       // clamp 0..(innerHeight - PANEL_MIN_H)
  minimized: boolean;
};

type LastExportRecord = {
  kind: 'fullPage' | 'element';
  filename: string;
  downloadId: number;
  finishedAtIso: string;
};
```

## Defaults
Constants live in `shared/defaults.ts`. The SW writes defaults on `chrome.runtime.onInstalled` (`reason === 'install'`) and on schema-version bumps.

## Migration rule
On SW startup:
1. Read `inspect-page`.
2. If undefined → write defaults.
3. If `schemaVersion < CURRENT_SCHEMA_VERSION` → run migration table in `shared/migrations.ts`, then write back.
4. Never throw on read; on parse failure, log `E_STORAGE_PARSE` and overwrite with defaults.

## Quotas
`chrome.storage.local` quota is 10 MiB. We store < 4 KiB. No risk, but writes MUST be debounced (`STORAGE_WRITE_DEBOUNCE_MS = 250`) to avoid thrash from drag events.

## Forbidden
- No use of `chrome.storage.sync` (size limits, conflicts).
- No `localStorage` anywhere (unavailable in SW).
- No IndexedDB in v1.
