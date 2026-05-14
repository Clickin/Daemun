import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  BAKED_QUERY_DATA_ELEMENT_ID,
  compactInitialQueryData,
  isBakedInitialQueryPath,
} from "utils/query/initial-data";
import themes from "utils/styles/themes";

import { serializePage } from "./inertia.js";

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function getManifestEntry() {
  const manifestPath = path.resolve(process.cwd(), "dist/client/.vite/manifest.json");
  if (!existsSync(manifestPath)) return null;

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return manifest["src/client.jsx"];
}

function devAssetTags() {
  const origin = (process.env.VITE_DEV_SERVER_ORIGIN || "").replace(/\/$/, "");
  const refreshRuntimeUrl = JSON.stringify(`${origin}/@react-refresh`);

  return [
    `<script type="module">
      import RefreshRuntime from ${refreshRuntimeUrl};
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>`,
    `<script type="module" src="${escapeAttribute(`${origin}/@vite/client`)}"></script>`,
    `<script type="module" src="${escapeAttribute(`${origin}/src/client.jsx`)}"></script>`,
  ];
}

function assetTags() {
  if (process.env.VITE_DEV_SERVER_ORIGIN) return devAssetTags();

  const entry = getManifestEntry();
  if (!entry) {
    return ['<script type="module" src="/src/client.jsx"></script>'];
  }

  const styles = (entry.css || []).map((href) => `<link rel="stylesheet" href="/${escapeAttribute(href)}">`);

  return [...styles, `<script type="module" src="/${escapeAttribute(entry.file)}"></script>`];
}

function defaultIconTags(settings) {
  if (settings.favicon) {
    const favicon = escapeAttribute(settings.favicon);
    return [
      `<link data-daemun-head rel="icon" href="${favicon}">`,
      `<link data-daemun-head rel="apple-touch-icon" sizes="180x180" href="${favicon}">`,
    ];
  }

  return [
    '<link data-daemun-head rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=4">',
    '<link data-daemun-head rel="shortcut icon" href="/daemun.ico">',
    '<link data-daemun-head rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=4">',
    '<link data-daemun-head rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=4">',
    '<link data-daemun-head rel="mask-icon" href="/safari-pinned-tab.svg?v=4" color="#1e9cd7">',
  ];
}

function headTags(settings) {
  const title = settings.title || "Daemun";
  const description =
    settings.description ||
    "A compact self-hosted dashboard with Docker and service API integrations.";
  const color = settings.color || "slate";
  const theme = settings.theme || "dark";
  const themeColor = themes[color]?.[theme] || themes.slate.dark;

  return [
    `<title>${escapeText(title)}</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">',
    '<meta name="mobile-web-app-capable" content="yes">',
    `<meta data-daemun-head name="description" content="${escapeAttribute(description)}">`,
    settings.disableIndexing ? '<meta data-daemun-head name="robots" content="noindex, nofollow">' : "",
    settings.base ? `<base data-daemun-head href="${escapeAttribute(settings.base)}">` : "",
    '<link rel="manifest" href="/site.webmanifest?v=4" crossorigin="use-credentials">',
    '<link rel="preload" href="/api/config/custom.css" as="style">',
    '<link rel="stylesheet" href="/api/config/custom.css">',
    ...defaultIconTags(settings),
    `<meta data-daemun-head name="msapplication-TileColor" content="${escapeAttribute(themeColor)}">`,
    `<meta data-daemun-head name="theme-color" content="${escapeAttribute(themeColor)}">`,
    '<meta data-daemun-head name="color-scheme" content="dark light">',
    ...assetTags(),
  ].filter(Boolean);
}

function bakedInitialQueryDataScript(fallback) {
  const compactQueryData = compactInitialQueryData(fallback);
  if (Object.keys(compactQueryData).length === 0) return "";

  return `<script id="${BAKED_QUERY_DATA_ELEMENT_ID}" type="application/json">${serializePage(compactQueryData)}</script>`;
}

function clientPageForHtml(page) {
  const fallback = page.props?.fallback;
  if (!fallback || typeof fallback !== "object") return page;

  const remainingFallback = Object.fromEntries(
    Object.entries(fallback).filter(([pathName]) => !isBakedInitialQueryPath(pathName)),
  );
  const props = { ...page.props };

  if (Object.keys(remainingFallback).length > 0) {
    props.fallback = remainingFallback;
  } else {
    delete props.fallback;
  }

  return { ...page, props };
}

export function rootView(page, options = {}) {
  const settings = page.props?.initialSettings || {};
  const theme = settings.theme || "dark";
  const color = settings.color || "slate";
  const initialQueryDataScript = bakedInitialQueryDataScript(page.props?.fallback);
  const clientPage = clientPageForHtml(page);
  const appHtml = options.appHtml || "";

  return `<!DOCTYPE html>
<html class="${escapeAttribute(`${theme === "dark" ? "dark scheme-dark" : "scheme-light"} theme-${color}`)}">
  <head>
    ${headTags(settings).join("\n    ")}
  </head>
  <body>
    ${initialQueryDataScript}
    <script data-page="app" type="application/json">${serializePage(clientPage)}</script>
    <div id="app">${appHtml}</div>
    <script src="/api/config/custom.js"></script>
  </body>
</html>`;
}
