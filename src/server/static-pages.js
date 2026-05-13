import checkAndCopyConfig, { getSettings } from "utils/config/config";
import themes from "utils/styles/themes";

export function browserConfigXml() {
  const settings = getSettings();

  const color = settings.color || "slate";
  const theme = settings.theme || "dark";

  return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
    <msapplication>
        <tile>
            <square150x150logo src="/mstile-150x150.png?v=2"/>
            <TileColor>${themes[color][theme]}</TileColor>
        </tile>
    </msapplication>
</browserconfig>`;
}

export function robotsTxt() {
  const settings = getSettings();
  return ["User-agent: *", settings.disableIndexing ? "Disallow: /" : "Allow: /"].join("\n");
}

export function siteWebmanifest() {
  checkAndCopyConfig("settings.yaml");
  const settings = getSettings();

  const color = settings.color || "slate";
  const theme = settings.theme || "dark";

  const pwa = settings.pwa || {};

  return {
    background_color: themes[color][theme],
    display: "standalone",
    icons: pwa.icons || [
      {
        sizes: "192x192",
        src: "/android-chrome-192x192.png?v=2",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/android-chrome-512x512.png?v=2",
        type: "image/png",
      },
    ],
    name: settings.title || "Homepage",
    shortcuts: pwa.shortcuts,
    short_name: settings.title || "Homepage",
    start_url: settings.startUrl || "/",
    theme_color: themes[color][theme],
  };
}
