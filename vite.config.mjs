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
            input: {
              app: "src/server/app.js",
              index: "src/server/index.js",
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
            input: "src/client.jsx",
            output: {
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
        }
      : undefined,
  };
});
