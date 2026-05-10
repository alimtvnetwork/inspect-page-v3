import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "./package.json" with { type: "json" };

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../extension-src");

export default defineConfig({
  root: srcRoot,
  build: {
    outDir: path.resolve(here, "dist/extension"),
    emptyOutDir: true,
    target: "chrome116",
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(srcRoot, "shared"),
      "@panel": path.resolve(srcRoot, "panel"),
      "@picker": path.resolve(srcRoot, "picker"),
      "@capture": path.resolve(srcRoot, "capture"),
      "@zip": path.resolve(srcRoot, "zip"),
      "@element": path.resolve(srcRoot, "element"),
      "@share": path.resolve(srcRoot, "share"),
      jszip: path.resolve(here, "node_modules/jszip/dist/jszip.min.js"),
      "html-to-image": path.resolve(here, "node_modules/html-to-image/dist/html-to-image.js"),
    },
  },
  define: {
    __EXT_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    webExtension({
      manifest: path.resolve(srcRoot, "manifest.json"),
      additionalInputs: ["offscreen.html"],
    }),
  ],
});
