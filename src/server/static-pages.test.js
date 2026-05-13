import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("renders site.webmanifest with configured title and colors", async () => {
    getSettings.mockReturnValueOnce({ color: "emerald", theme: "light", title: "Lab" });
    const { siteWebmanifest } = await import("./static-pages");

    expect(siteWebmanifest()).toMatchObject({
      display: "standalone",
      name: "Lab",
      short_name: "Lab",
      start_url: "/",
    });
    expect(checkAndCopyConfig).toHaveBeenCalledWith("settings.yaml");
  });

  it("renders browserconfig XML", async () => {
    getSettings.mockReturnValueOnce({ color: "slate", theme: "dark" });
    const { browserConfigXml } = await import("./static-pages");
    const xml = browserConfigXml();

    expect(xml).toContain("<browserconfig>");
    expect(xml).toContain("<TileColor>");
  });
});
