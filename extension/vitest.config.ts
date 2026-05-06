import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, "../extension-src");

export default defineConfig({
  test: {
    environment: "node",
    include: [path.resolve(srcRoot, "**/__tests__/**/*.test.ts")],
    globals: false,
    // Per-file environments: capture/* tests touch the DOM and need jsdom.
    environmentMatchGlobs: [
      [path.resolve(srcRoot, "capture/**"), "happy-dom"],
      [path.resolve(srcRoot, "element/**"), "happy-dom"],
    ],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(srcRoot, "shared"),
      "@panel": path.resolve(srcRoot, "panel"),
      "@picker": path.resolve(srcRoot, "picker"),
      "@capture": path.resolve(srcRoot, "capture"),
      "@zip": path.resolve(srcRoot, "zip"),
    },
  },
  define: {
    __EXT_VERSION__: JSON.stringify("1.0.0"),
  },
});
