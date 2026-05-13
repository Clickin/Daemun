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

function clientManualChunks(id) {
  const normalizedId = id.replaceAll("\\", "/");

  if (normalizedId.includes("/node_modules/")) {
    if (
      normalizedId.includes("/react/") ||
      normalizedId.includes("/react-dom/") ||
      normalizedId.includes("/scheduler/") ||
      normalizedId.includes("/@inertiajs/")
    ) {
      return "vendor-react";
    }

    if (normalizedId.includes("/@headlessui/")) {
      return "vendor-headlessui";
    }

    if (normalizedId.includes("/react-icons/")) {
      return "vendor-icons";
    }

    if (
      normalizedId.includes("/i18next") ||
      normalizedId.includes("/react-i18next/") ||
      normalizedId.includes("/i18next-browser-languagedetector/")
    ) {
      return "vendor-i18n";
    }

    if (
      normalizedId.includes("/swr/") ||
      normalizedId.includes("/stable-hash/") ||
      normalizedId.includes("/use-sync-external-store/")
    ) {
      return "vendor-data";
    }

    if (normalizedId.includes("/date-fns/") || normalizedId.includes("/dayjs/") || normalizedId.includes("/luxon/")) {
      return "vendor-date";
    }

    return "vendor";
  }

  if (normalizedId.includes("/src/components/quicklaunch")) {
    return "quicklaunch";
  }

  if (normalizedId.includes("/src/components/services/")) {
    return "services";
  }

  if (normalizedId.includes("/src/components/bookmarks/")) {
    return "bookmarks";
  }

  if (normalizedId.includes("/src/components/widgets/")) {
    return "info-widgets";
  }

  return undefined;
}

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
            output: {
              manualChunks: clientManualChunks,
            },
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
