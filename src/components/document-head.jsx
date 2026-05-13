import { useEffect } from "react";

import themes from "utils/styles/themes";

function appendTag(tagName, attributes) {
  const element = document.createElement(tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  });
  element.setAttribute("data-homepage-head", "true");
  document.head.appendChild(element);
}

function iconTags(settings) {
  if (settings.favicon) {
    return [
      ["link", { href: settings.favicon, rel: "icon" }],
      ["link", { href: settings.favicon, rel: "apple-touch-icon", sizes: "180x180" }],
    ];
  }

  return [
    ["link", { href: "/apple-touch-icon.png?v=4", rel: "apple-touch-icon", sizes: "180x180" }],
    ["link", { href: "/homepage.ico", rel: "shortcut icon" }],
    ["link", { href: "/favicon-32x32.png?v=4", rel: "icon", sizes: "32x32", type: "image/png" }],
    ["link", { href: "/favicon-16x16.png?v=4", rel: "icon", sizes: "16x16", type: "image/png" }],
    ["link", { color: "#1e9cd7", href: "/safari-pinned-tab.svg?v=4", rel: "mask-icon" }],
  ];
}

export default function DocumentHead({ settings }) {
  useEffect(() => {
    document.querySelectorAll("[data-homepage-head]").forEach((node) => node.remove());

    const title = settings.title || "Homepage";
    const description =
      settings.description ||
      "A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations.";
    const color = settings.color || "slate";
    const theme = settings.theme || "dark";
    const themeColor = themes[color]?.[theme] || themes.slate.dark;

    document.title = title;

    appendTag("meta", { content: description, name: "description" });
    if (settings.disableIndexing) {
      appendTag("meta", { content: "noindex, nofollow", name: "robots" });
    }
    if (settings.base) {
      appendTag("base", { href: settings.base });
    }

    iconTags(settings).forEach(([tagName, attributes]) => appendTag(tagName, attributes));
    appendTag("meta", { content: themeColor, name: "msapplication-TileColor" });
    appendTag("meta", { content: themeColor, name: "theme-color" });
    appendTag("meta", { content: "dark light", name: "color-scheme" });
  }, [settings]);

  return null;
}
