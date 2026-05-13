import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../extension-src");

export default defineConfig({
  server: {
    fs: {
      // Tests live outside the package root (../extension-src). Allow vite's
      // web-mode loader (used by happy-dom/jsdom envs) to read them.
      allow: [path.resolve(here, ".."), srcRoot],
    },
  },
  test: {
    environment: "node",
    include: [path.resolve(srcRoot, "**/__tests__/**/*.test.ts")],
    globals: false,
    // Per-file environments: capture/* tests touch the DOM and need jsdom.
    environmentMatchGlobs: [
      [path.resolve(srcRoot, "capture/**"), "happy-dom"],
      [path.resolve(srcRoot, "element/**"), "happy-dom"],
      [path.resolve(srcRoot, "inspect/**"), "happy-dom"],
    ],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(srcRoot, "shared"),
      "@panel": path.resolve(srcRoot, "panel"),
      "@picker": path.resolve(srcRoot, "picker"),
      "@capture": path.resolve(srcRoot, "capture"),
      "@zip": path.resolve(srcRoot, "zip"),
      "@share": path.resolve(srcRoot, "share"),
    },
  },
  define: {
    __EXT_VERSION__: JSON.stringify("1.0.0"),
  },
});
