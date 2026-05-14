import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.mjs";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    exclude: [],
    include: ["src/server/browserless-smoke.test.jsx"],
    testTimeout: 30_000,
  },
});
