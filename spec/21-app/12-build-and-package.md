# 12 — Build and packaging

## Toolchain (pinned)

| Tool | Version | Notes |
|---|---|---|
| Node | 20.x LTS | `.nvmrc` = `20`. |
| Package manager | `bun` ≥ 1.1 (Lovable default) | `bun install`, `bun run`. |
| Vite | `^5.4` | Build. |
| `vite-plugin-web-extension` | `^4.4` | MV3-aware build, asset copy. |
| TypeScript | `^5.6` | `strict: true`. |
| React | `^18.3` | Popup + panel UI. |
| Tailwind CSS | `^3.4` | Inside Shadow DOM. |
| JSZip | `^3.10` | ZIP assembly. |
| `html-to-image` | `^1.11` | Isolated element render. |
| `nanoid` | `^5.0` | `requestId` generation. |
| Vitest | `^2.1` | Unit tests for shared helpers (no DOM needed). |

No other runtime deps. Dev-only deps: `@types/chrome`, `@types/react`, `@types/react-dom`, `eslint`, `prettier`, `typescript-eslint`.

## Source layout

```
extension-src/
├── manifest.json                 (final form below)
├── background.ts                 SW orchestrator
├── content.ts                    CS entry + panel mount + picker mount
├── offscreen.html
├── offscreen.ts
├── popup/
│   ├── index.html
│   └── main.tsx                  Renders <ExportPanel surface="popup" />
├── panel/
│   ├── mount.ts                  Shadow DOM mount
│   ├── ExportPanel.tsx           Shared component
│   ├── StatusRow.tsx
│   ├── SettingsForm.tsx
│   └── DragHeader.tsx
├── picker/
│   ├── overlay.ts
│   └── pickerMode.ts
├── capture/
│   ├── stitch.ts                 (offscreen-side helper bundled into offscreen.ts)
│   ├── elementShot.ts
│   └── isolatedRender.ts
├── zip/
│   └── bundle.ts
├── shared/
│   ├── messages.ts               MessageKind + envelope types
│   ├── constants.ts              All values from 20-performance-budgets.md
│   ├── defaults.ts               Settings defaults
│   ├── copy.ts                   COPY map from 02-ui-panel.md §D
│   ├── logger.ts                 logger.{debug,info,warn,error}
│   ├── settings.ts               GetSettings/SetSettings facade
│   ├── naming.ts                 Filename templating from 07
│   ├── css-collect.ts
│   ├── js-collect.ts
│   ├── html-snapshot.ts
│   ├── matched-rules.ts
│   ├── computed-diff.ts
│   ├── selector-path.ts
│   ├── fetch-text.ts             fetch() wrapper with error mapping
│   └── types.ts                  Settings, ExportMeta, etc.
└── icons/
    ├── 16.png
    ├── 48.png
    └── 128.png
```

## `manifest.json` (final form)

```json
{
  "manifest_version": 3,
  "name": "PagePort",
  "short_name": "PagePort",
  "version": "1.0.0",
  "description": "Export any web page (or one element) for your LLM: HTML, CSS, JS and a full-page screenshot.",
  "minimum_chrome_version": "116",
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" },
  "action": {
    "default_title": "PagePort",
    "default_popup": "popup/index.html",
    "default_icon": { "16": "icons/16.png", "48": "icons/48.png" }
  },
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "permissions": ["activeTab", "scripting", "tabs", "downloads", "storage", "offscreen"],
  "host_permissions": ["<all_urls>"],
  "commands": {
    "trigger-full-page": {
      "suggested_key": { "default": "Alt+Shift+E" },
      "description": "Export Full Page"
    },
    "trigger-pick-element": {
      "suggested_key": { "default": "Alt+Shift+P" },
      "description": "Pick Element"
    }
  },
  "web_accessible_resources": [
    { "resources": ["offscreen.html", "icons/*.png"], "matches": ["<all_urls>"] }
  ]
}
```

## `vite.config.ts` outline

```text
- plugins: [react(), webExtension({
    manifest: 'extension-src/manifest.json',
    additionalInputs: { html: ['extension-src/offscreen.html'] }
  })]
- build.outDir = 'dist/extension'
- build.emptyOutDir = true
- build.rollupOptions.output.format = 'es'
- resolve.alias: '@shared' -> 'extension-src/shared', '@panel' -> 'extension-src/panel'
- define: { __EXT_VERSION__: JSON.stringify(pkg.version) }
- esbuild.target: 'chrome116'
```

## `tsconfig.json` (extension package)

```text
- strict: true
- noUncheckedIndexedAccess: true
- noImplicitOverride: true
- exactOptionalPropertyTypes: true
- target: ES2022
- module: ESNext
- moduleResolution: Bundler
- lib: ['ES2022', 'DOM', 'DOM.Iterable', 'WebWorker']
- types: ['chrome', 'vite/client']
- isolatedModules: true
- noEmit: true   (Vite handles emit)
```

## ESLint rules (must enforce)

- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unsafe-*: error`
- `complexity: ['error', { max: 6 }]`
- `max-lines-per-function: ['error', { max: 8, skipBlankLines: true, skipComments: true }]`
- `max-lines: ['error', 100]`
- `no-magic-numbers: ['error', { ignore: [0, 1, -1], ignoreEnums: true, ignoreNumericLiteralTypes: true }]`
- Custom rule (or naming convention): boolean identifiers MUST start with `is` or `has`.

## Build commands

```bash
# install
bun install

# dev (loads dist/extension as unpacked manually)
bun run build:watch         # vite build --watch

# production build
bun run build               # vite build

# package (zip dist/extension into public/pageport.zip)
bun run package
```

`package.json` scripts:
```json
{
  "scripts": {
    "build": "vite build",
    "build:watch": "vite build --watch",
    "package": "bash scripts/package.sh",
    "test": "vitest run",
    "lint": "eslint extension-src --max-warnings=0"
  }
}
```

## `scripts/package.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
rm -f public/pageport.zip
cd dist/extension
nix run nixpkgs#zip -- -r ../../public/pageport.zip .
cd -
sha256sum public/pageport.zip > public/pageport.zip.sha256
echo "Built $(du -h public/pageport.zip | cut -f1) — see sha256 next to it."
```

## Build acceptance
- `bun run lint` exits 0.
- `bun run test` exits 0.
- `bun run build` produces `dist/extension/manifest.json` with `manifest_version: 3`.
- `bun run package` writes `public/pageport.zip` ≤ `1.5 MiB` (see `20-performance-budgets.md`).
- Loading `dist/extension` via `chrome://extensions` → "Load unpacked" succeeds with no warnings in the extension's "Errors" pane.

## Distribution
The Lovable host page (see `18-distribution-page.md`) downloads `/pageport.zip` via the fetch+blob approach.
