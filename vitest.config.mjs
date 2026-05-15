import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest uses Vite/esbuild, so enable the modern JSX runtime
  // to avoid requiring `import React from "react"` in every TSX file.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      components: fileURLToPath(new URL("./src/components", import.meta.url)),
      pages: fileURLToPath(new URL("./src/pages", import.meta.url)),
      styles: fileURLToPath(new URL("./src/styles", import.meta.url)),
      "test-utils": fileURLToPath(new URL("./src/test-utils", import.meta.url)),
      utils: fileURLToPath(new URL("./src/utils", import.meta.url)),
      widgets: fileURLToPath(new URL("./src/widgets", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Use worker threads instead of forked processes to reduce overhead and avoid noisy per-process Node warnings.
    pool: "threads",
    setupFiles: ["./vitest.setup.mjs"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    exclude: ["src/server/browserless-smoke.test.tsx"],
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Ignore build artifacts / generated reports
        "dist/**",
        "coverage/**",
        // Exclude tests and test harness code from coverage totals.
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "test/**",
        "src/test-utils/**",
        "src/widgets/widgets.ts",
        "src/widgets/components.ts",
        "src/skeleton/custom.js",
        "vitest.config.mjs",
      ],
    },
  },
});
