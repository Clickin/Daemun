import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const aliases = {
  components: "./src/components",
  pages: "./src/pages",
  styles: "./src/styles",
  "test-utils": "./src/test-utils",
  utils: "./src/utils",
  widgets: "./src/widgets",
};

const resolvedAliases = Object.fromEntries(
  Object.entries(aliases).map(([key, value]) => [key, fileURLToPath(new URL(value, import.meta.url))]),
);

const buildTime = process.env.NEXT_PUBLIC_BUILDTIME || process.env.BUILDTIME || "";
const revision = process.env.NEXT_PUBLIC_REVISION || process.env.REVISION || "";
const version = process.env.NEXT_PUBLIC_VERSION || process.env.VERSION || "";

export default defineConfig((configEnv) => {
  const isSsrBuild = configEnv.isSsrBuild || configEnv.ssrBuild;

  return {
    build: isSsrBuild
      ? {
          emptyOutDir: true,
          outDir: "dist/server",
          rollupOptions: {
            input: "src/server/index.js",
            output: {
              chunkFileNames: "chunks/[name]-[hash].mjs",
              entryFileNames: "[name].mjs",
            },
          },
          ssr: "src/server/index.js",
        }
      : {
          emptyOutDir: true,
          manifest: true,
          outDir: "dist/client",
          rollupOptions: {
            input: "src/client.jsx",
          },
        },
    define: {
      "process.env.NEXT_PUBLIC_BUILDTIME": JSON.stringify(buildTime),
      "process.env.NEXT_PUBLIC_REVISION": JSON.stringify(revision),
      "process.env.NEXT_PUBLIC_VERSION": JSON.stringify(version),
    },
    plugins: [react()],
    resolve: {
      alias: resolvedAliases,
    },
  };
});
