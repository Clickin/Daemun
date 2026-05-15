import { beforeEach, describe, expect, it, vi } from "vitest";

import themes from "utils/styles/themes";

const { checkAndCopyConfig, getSettings } = vi.hoisted(() => ({
  checkAndCopyConfig: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("utils/config/config", () => ({
  default: checkAndCopyConfig,
  getSettings,
}));

describe("static page payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders robots.txt from disableIndexing", async () => {
    getSettings.mockReturnValueOnce({ disableIndexing: true });
    const { robotsTxt } = await import("./static-pages");

    expect(robotsTxt()).toBe("User-agent: *\nDisallow: /");
  });

  it("allows robots.txt indexing by default", async () => {
    getSettings.mockReturnValueOnce({ disableIndexing: false });
    const { robotsTxt } = await import("./static-pages");

    expect(robotsTxt()).toBe("User-agent: *\nAllow: /");
  });

  it("renders site.webmanifest with configured title and colors", async () => {
    getSettings.mockReturnValueOnce({
      color: "emerald",
      pwa: {
        icons: [{ sizes: "1x1", src: "/i.png", type: "image/png" }],
        shortcuts: [{ name: "One", url: "/one" }],
      },
      startUrl: "/start",
      theme: "light",
      title: "Lab",
    });
    const { siteWebmanifest } = await import("./static-pages");

    const manifest = siteWebmanifest();

    expect(manifest).toMatchObject({
      background_color: themes.emerald.light,
      display: "standalone",
      icons: [{ sizes: "1x1", src: "/i.png", type: "image/png" }],
      name: "Lab",
      shortcuts: [{ name: "One", url: "/one" }],
      short_name: "Lab",
      start_url: "/start",
      theme_color: themes.emerald.light,
    });
    expect(checkAndCopyConfig).toHaveBeenCalledWith("settings.yaml");
  });

  it("renders site.webmanifest defaults", async () => {
    getSettings.mockReturnValueOnce({});
    const { siteWebmanifest } = await import("./static-pages");

    const manifest = siteWebmanifest();

    expect(manifest).toMatchObject({
      background_color: themes.slate.dark,
      display: "standalone",
      name: "Daemun",
      short_name: "Daemun",
      start_url: "/",
      theme_color: themes.slate.dark,
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: expect.stringContaining("android-chrome-192x192") }),
        expect.objectContaining({ src: expect.stringContaining("android-chrome-512x512") }),
      ]),
    );
  });

  it("renders browserconfig XML", async () => {
    getSettings.mockReturnValueOnce({ color: "slate", theme: "dark" });
    const { browserConfigXml } = await import("./static-pages");
    const xml = browserConfigXml();

    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain("<browserconfig>");
    expect(xml).toContain('<square150x150logo src="/mstile-150x150.png?v=5"/>');
    expect(xml).toContain(`<TileColor>${themes.slate.dark}</TileColor>`);
  });
});
