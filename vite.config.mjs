import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
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
resolvedAliases["cpu-features"] = fileURLToPath(new URL("./src/server/shims/cpu-features.cjs", import.meta.url));

const buildTime = process.env.VITE_BUILDTIME || process.env.BUILDTIME || "";
const revision = process.env.VITE_REVISION || process.env.REVISION || "";
const version = process.env.VITE_VERSION || process.env.VERSION || "";

export function clientManualChunks(id) {
  const normalizedId = id.replaceAll("\\", "/");

  if (normalizedId.includes("/node_modules/")) {
    const isPackage = (packageName) => normalizedId.includes(`/node_modules/${packageName}/`);

    if (isPackage("react") || isPackage("react-dom") || isPackage("scheduler")) {
      return "vendor-react";
    }

    if (isPackage("@tanstack/query-core") || isPackage("@tanstack/react-query")) {
      return "vendor-query";
    }

    if (isPackage("i18next") || isPackage("react-i18next")) {
      return "vendor-i18n";
    }
  }

  return undefined;
}

export function clientChunkFileNames() {
  return "assets/[name]-[hash].js";
}

export default defineConfig((configEnv) => {
  const isSsrBuild = configEnv.isSsrBuild || configEnv.ssrBuild;

  return {
    build: isSsrBuild
      ? {
          emptyOutDir: true,
          outDir: "dist/server",
          rollupOptions: {
            input: {
              app: "src/server/app.ts",
              index: "src/server/index.ts",
            },
            output: {
              banner: "const __filename = import.meta.filename; const __dirname = import.meta.dirname;",
              chunkFileNames: "chunks/[name]-[hash].mjs",
              entryFileNames: "[name].mjs",
            },
          },
          ssr: true,
        }
      : {
          emptyOutDir: true,
          manifest: true,
          outDir: "dist/client",
          rollupOptions: {
            input: "src/client.tsx",
            output: {
              chunkFileNames: clientChunkFileNames,
              manualChunks: clientManualChunks,
            },
          },
        },
    define: {
      "process.env.VITE_BUILDTIME": JSON.stringify(buildTime),
      "process.env.VITE_REVISION": JSON.stringify(revision),
      "process.env.VITE_VERSION": JSON.stringify(version),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: resolvedAliases,
    },
    ssr: isSsrBuild
      ? {
          noExternal: true,
          external: ["osx-temperature-sensor", "macos-temperature-sensor"],
        }
      : undefined,
  };
});
