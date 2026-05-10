# 23 — Implementation order (file-by-file)

Read this file FIRST when starting to build. Every entry lists the file, what to build in it, what specs to consult, and what files MUST exist before you start it.

Order is strict. Do not skip ahead. Each step ends with a verification you must pass before proceeding.

## Stage 0 — Skeleton

### 0.1 `package.json`, `tsconfig.json`, `vite.config.ts`, `.nvmrc`, `bunfig.toml` (if needed)
Specs: `12-build-and-package.md`.
Depends on: nothing.
Verify: `bun install` succeeds.

### 0.2 `extension-src/manifest.json`
Spec: `12-build-and-package.md` §manifest, `08-permissions.md`.
Verify: matches the JSON in `12` byte-for-byte (except `version` bumps).

### 0.3 Icons (`extension-src/icons/{16,48,128}.png`)
Spec: any neutral icon. Use `imagegen` if needed.
Verify: files exist; sizes correct.

### 0.4 `extension-src/shared/constants.ts`
Spec: `20-performance-budgets.md` (every constant), plus enums `MessageKind`, `PanelStatus`, `LogCategory`, `ErrorCode` from `15`, `02`, `09`.
Depends on: 0.1.
Verify: `bun run lint` passes; no magic numbers.

### 0.5 `extension-src/shared/types.ts`
Spec: `15-message-contracts.md` (envelopes), `16-storage-schema.md` (StorageRoot, Settings), `17-file-formats.md` (ExportMeta).
Depends on: 0.4.

### 0.6 `extension-src/shared/copy.ts`
Spec: `02-ui-panel.md` §D copy table.
Depends on: 0.4.

### 0.7 `extension-src/shared/defaults.ts`
Spec: `16-storage-schema.md` defaults.
Depends on: 0.4, 0.5.

### 0.8 `extension-src/shared/logger.ts`
Spec: `09-error-handling.md` rules.
Depends on: 0.4.

### Verification gate 0
- `bun run lint` → 0 errors.
- `bun run build` → emits `dist/extension/` with manifest + empty entry stubs (you may temporarily have empty `background.ts` and `content.ts`).

## Stage 1 — Storage and settings facade

### 1.1 `shared/settings.ts`
Spec: `16-storage-schema.md` migration + debounced writes.
Depends on: 0.5, 0.7, 0.8.

### 1.2 Unit tests for settings (Vitest)
Tests: defaults applied on first read; migration path; debounce coalesces.

### Verification gate 1
- `bun run test` → 0 failures.

## Stage 2 — Service worker shell + messaging

### 2.1 `background.ts` (router only)
Spec: `15-message-contracts.md`. Implement envelope dispatcher, `Ping`, `GetSettings`, `SetSettings`. No export logic yet.
Depends on: 0.4–0.8, 1.1.

### 2.2 `content.ts` (router only)
Spec: `15`. Handle `Ping` and a future `MountFloatingPanel` no-op.
Depends on: 0.4, 0.8.

### Verification gate 2
- Load unpacked. From popup DevTools console (after adding popup in 3.x), `chrome.runtime.sendMessage({kind:'Ping', requestId, payload:{}})` resolves with `{ok:true}` from SW.

## Stage 3 — Popup UI

### 3.1 `popup/index.html` + `popup/main.tsx`
### 3.2 `panel/ExportPanel.tsx`, `panel/StatusRow.tsx`, `panel/SettingsForm.tsx`, `panel/DragHeader.tsx`
Spec: `02-ui-panel.md` (wireframes, copy, a11y, keyboard map).
Depends on: 0.6, 0.7, 1.1.
Note: `<ExportPanel surface="popup">` renders without drag header.

### 3.3 Disabled state on `chrome://`/`data:`/`about:` (T9 path).
Spec: `19-edge-cases.md` E7, E8.

### Verification gate 3 (manual, T11 partial)
- Popup opens, settings persist, status row updates.

## Stage 4 — Floating panel mount

### 4.1 `panel/mount.ts`
Spec: `02-ui-panel.md` §A2, §I; `04-element-picker.md` shadow root requirement.
Depends on: 3.2.

### 4.2 Wire popup `Open panel on page` → `MountFloatingPanel` → CS → mount.

### Verification gate 4 (T12)
- Panel mounts, drags, position persists.

## Stage 5 — Full Page collection (no screenshot yet)

### 5.1 `shared/fetch-text.ts`
### 5.2 `shared/css-collect.ts`
Spec: `03-full-page-export.md` P2; `09` warn codes.
### 5.3 `shared/js-collect.ts`
Spec: `03` P3.
### 5.4 `shared/html-snapshot.ts`
Spec: `03` P1; `21-security-privacy.md` redaction.
### 5.5 `shared/naming.ts`
Spec: `07-file-naming.md`.
### 5.6 `zip/bundle.ts`
Spec: `03` P6, `17-file-formats.md`.
### 5.7 Wire `RunFullPageExport` (without screenshot — empty PNG placeholder).

### Verification gate 5
- Full Page export downloads a ZIP missing only a real `screenshot.png` (placeholder 1×1 PNG OK).
- `manifest.json` validates against schema in `17`.

## Stage 6 — Offscreen document + screenshot

### 6.1 `offscreen.html`
### 6.2 `offscreen.ts`
Spec: `06-screenshot-strategy.md` §C; `15` `OffscreenAddFrame`/`OffscreenStitchFinish`.

### 6.3 SW: own offscreen lifecycle (`chrome.offscreen.createDocument` / `closeDocument`).

### 6.4 CS: `BeginScrollCapture`, `RestoreAfterCapture`. Spec: `06` §A, §D.

### 6.5 SW: per-step capture loop with `CAPTURE_GAP_MS` throttle and retry. Spec: `06` §B.

### 6.6 SW: `chrome.alarms` keep-alive during exports. Spec: `19` E20.

### Verification gate 6 (T1, T2, T3)
- Real `screenshot.png` of full page; sticky elements not ghosted; `pageCssPx.h * dpr` height.

## Stage 7 — Element picker

### 7.1 `picker/overlay.ts`
### 7.2 `picker/pickerMode.ts`
Spec: `04-element-picker.md` (state machine, listeners, capture phase rules).

### 7.3 Wire popup/panel `Pick Element` → `EnterPickerMode`.

### Verification gate 7 (T6, T7)
- Picker activates, highlights, right-click consumed, Escape cancels.

## Stage 8 — Element export

### 8.1 `shared/selector-path.ts` — Spec `05` P1.
### 8.2 `shared/matched-rules.ts` — Spec `05` P3.
### 8.3 `shared/computed-diff.ts` — Spec `05` P4.
### 8.4 `capture/elementShot.ts` — Spec `05` P5.
### 8.5 `capture/isolatedRender.ts` (offscreen-side) — Spec `05` P6.
### 8.6 SW: assemble Markdown per template; degrade to budget — Spec `05` P7, `17` §B.

### Verification gate 8 (T4, T5, T13)
- `.md` opens with both screenshots; redaction applied; under budget.

## Stage 9 — Edge cases & polish

### 9.1 SPA route-change abort. Spec: `19` E9 / `E_ROUTE_CHANGED`.
### 9.2 `E_PAGE_TOO_LARGE`. Spec: `19` E11, `06` §B.
### 9.3 Disabled buttons on unsupported URLs. Spec: `19` E7/E8.
### 9.4 Reduced-motion handling. Spec: `02` §G.
### 9.5 Keyboard `commands`. Spec: `02` §E.

### Verification gate 9 (T8, T9, T10, T15, T16)
- All AC-RB and AC-UI items pass.

## Stage 10 — Distribution page

### 10.1 In the Lovable host project (`src/pages/Index.tsx`), implement page per `18-distribution-page.md`.
### 10.2 Wire fetch+blob download for `/pageport.zip`.
### 10.3 SEO meta + JSON-LD per `18`.

### Verification gate 10
- AC-BD-4 passes.

## Stage 11 — Package and ship

### 11.1 `scripts/package.sh`. Spec: `12` §package script.
### 11.2 Run `bun run lint && bun run test && bun run build && bun run package`.
### 11.3 Confirm `public/pageport.zip` ≤ 1.5 MiB; `.sha256` next to it.

### Verification gate 11 (T17, T18, AC-BD)
- All items in `11-acceptance-criteria.md` checked.

## Done
Mark every AC checkbox. Tag `v1.0.0` in `manifest.json` and in the `package.json` of the extension package.
