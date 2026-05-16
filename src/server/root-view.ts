import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  BAKED_PAGE_PROPS_ELEMENT_ID,
  BAKED_QUERY_DATA_ELEMENT_ID,
  compactInitialPageProps,
  compactInitialQueryData,
} from "utils/query/initial-data";
import themes from "utils/styles/themes";

import type { HomePageProps, SettingsRecord } from "../types";

interface RootViewOptions {
  appHtml?: string;
}

interface ManifestEntry {
  css?: string[];
  file?: string;
  imports?: string[];
}

type ClientManifest = Record<string, ManifestEntry>;

function isRootViewOptions(value: unknown): value is RootViewOptions {
  return Boolean(value) && typeof value === "object" && "appHtml" in value;
}

function escapeText(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: unknown) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function serializeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("/", "\\/");
}

function getClientManifest() {
  const manifestPath = process.env.DAEMUN_CLIENT_MANIFEST_PATH || path.resolve(process.cwd(), "dist/client/.vite/manifest.json");
  if (!existsSync(manifestPath)) return null;

  return JSON.parse(readFileSync(manifestPath, "utf8")) as ClientManifest;
}

function getManifestEntry(manifest: ClientManifest) {
  return manifest["src/client.tsx"];
}

function collectStaticImportFiles(manifest: ClientManifest, entry: ManifestEntry) {
  const files: string[] = [];
  const seen = new Set<string>();

  function visit(key: string) {
    if (seen.has(key)) return;
    seen.add(key);

    const imported = manifest[key];
    if (!imported) return;

    if (imported.file?.endsWith(".js")) {
      files.push(imported.file);
    }

    for (const childKey of imported.imports || []) {
      visit(childKey);
    }
  }

  for (const key of entry.imports || []) {
    visit(key);
  }

  return files;
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
    `<script type="module" src="${escapeAttribute(`${origin}/src/client.tsx`)}"></script>`,
  ];
}

function assetTags() {
  if (process.env.VITE_DEV_SERVER_ORIGIN) return devAssetTags();

  const manifest = getClientManifest();
  const entry = manifest ? getManifestEntry(manifest) : null;
  if (!entry) {
    return ['<script type="module" src="/src/client.tsx"></script>'];
  }

  const styles = (entry.css || []).map((href) => `<link rel="stylesheet" href="/${escapeAttribute(href)}">`);
  const modulePreloads = collectStaticImportFiles(manifest, entry).map(
    (href) => `<link rel="modulepreload" crossorigin href="/${escapeAttribute(href)}">`,
  );

  return [...styles, ...modulePreloads, `<script type="module" src="/${escapeAttribute(entry.file)}"></script>`];
}

function defaultIconTags(settings: SettingsRecord) {
  if (settings.favicon) {
    const favicon = escapeAttribute(settings.favicon);
    return [
      `<link data-daemun-head rel="icon" href="${favicon}">`,
      `<link data-daemun-head rel="apple-touch-icon" sizes="180x180" href="${favicon}">`,
    ];
  }

  return [
    '<link data-daemun-head rel="icon" type="image/svg+xml" href="/daemun.svg?v=5">',
    '<link data-daemun-head rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=5">',
    '<link data-daemun-head rel="shortcut icon" href="/daemun.ico">',
    '<link data-daemun-head rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=5">',
    '<link data-daemun-head rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=5">',
    '<link data-daemun-head rel="mask-icon" href="/safari-pinned-tab.svg?v=5" color="#0072ce">',
  ];
}

function headTags(settings: SettingsRecord) {
  const title = settings.title || "Daemun";
  const description =
    settings.description || "A compact self-hosted dashboard with Docker and service API integrations.";
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

function bakedInitialQueryDataScript(fallback: unknown) {
  const compactQueryData = compactInitialQueryData(fallback);
  if (Object.keys(compactQueryData).length === 0) return "";

  return `<script id="${BAKED_QUERY_DATA_ELEMENT_ID}" type="application/json">${serializeScriptJson(compactQueryData)}</script>`;
}

function bakedInitialPagePropsScript(pageProps: unknown) {
  const compactPageProps = compactInitialPageProps(pageProps);
  if (Object.keys(compactPageProps).length === 0) return "";

  return `<script id="${BAKED_PAGE_PROPS_ELEMENT_ID}" type="application/json">${serializeScriptJson(compactPageProps)}</script>`;
}

export function rootView(props: Pick<HomePageProps, "fallback" | "initialSettings" | "locale">, context: unknown = {}) {
  const settings = (props.initialSettings || {}) as SettingsRecord;
  const theme = settings.theme || "dark";
  const color = settings.color || "slate";
  const initialPagePropsScript = bakedInitialPagePropsScript(props);
  const initialQueryDataScript = bakedInitialQueryDataScript(props.fallback);
  const appHtml = isRootViewOptions(context) ? (context.appHtml ?? "") : "";

  return `<!DOCTYPE html>
<html class="${escapeAttribute(`${theme === "dark" ? "dark scheme-dark" : "scheme-light"} theme-${color}`)}">
  <head>
    ${headTags(settings).join("\n    ")}
  </head>
  <body>
    ${initialPagePropsScript}
    ${initialQueryDataScript}
    <div id="app">${appHtml}</div>
    <script src="/api/config/custom.js"></script>
  </body>
</html>`;
}
