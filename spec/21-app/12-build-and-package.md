# 12 — Build and packaging

## Stack
Vite + TypeScript + React + Tailwind + JSZip + html-to-image.

## Source layout
```
extension-src/
  manifest.json
  background.ts
  content.ts
  offscreen.html
  offscreen.ts
  popup/
    index.html
    main.tsx
  panel/
    mount.ts
    Panel.tsx
  shared/
    messages.ts        MessageKind enum + types
    constants.ts
    logger.ts
    css-collect.ts
    js-collect.ts
    naming.ts
    settings.ts
  picker/
    overlay.ts
    pickerMode.ts
  capture/
    stitch.ts
    elementShot.ts
  zip/
    bundle.ts
```

## Build outputs
`dist/extension/` — loadable unpacked.

## Packaging
```bash
rm -f public/llm-export.zip
cd dist/extension && nix run nixpkgs#zip -- -r ../../public/llm-export.zip .
```

## Distribution UI (separate Lovable app page)
A single landing page in the Lovable project that:
- Explains the extension.
- Downloads `/llm-export.zip` via fetch + blob (auth-safe).
- Shows install steps for `chrome://extensions` → Developer mode → Load unpacked.
