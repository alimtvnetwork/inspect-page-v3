# Inspect Page — Load Unpacked

This folder is the **already-built** Chrome extension. Load it directly:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** → select this `extension-unpacked/` folder

No download, no unzip. After pulling new code, rebuild with:

```bash
cd extension && bun install && bun run build
cp -r dist/extension/* ../extension-unpacked/
```

Or run `bash scripts/refresh-unpacked.sh` from the repo root.

After rebuilding, click the **reload** icon on the extension card in `chrome://extensions`.