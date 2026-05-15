import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadHomePageProps } = vi.hoisted(() => ({
  loadHomePageProps: vi.fn(async () => ({
    fallback: {
      "/api/bookmarks": [
        {
          bookmarks: [{ description: "Static bookmark description", href: "https://example.com", name: "Static Link" }],
          name: "Static Bookmarks",
        },
      ],
      "/api/hash": false,
      "/api/services": [
        {
          groups: [],
          name: "Static Services",
          services: [
            { description: "Static service description", href: "https://example.com", name: "Static App", widgets: [] },
          ],
        },
      ],
      "/api/validate": [],
      "/api/widgets": [],
    },
    initialSettings: { color: "emerald", hideVersion: true, layout: {}, theme: "light", title: "Static Lab" },
    locale: "en",
  })),
}));

vi.mock("./home-props", () => ({
  loadHomePageProps,
}));

vi.mock("utils/i18n", () => ({
  default: { changeLanguage: vi.fn(), language: "en" },
  loadLanguage: vi.fn(async (language) => language),
}));

describe("static home SSG cache", () => {
  let tempDir;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(path.join(os.tmpdir(), "daemun-static-home-"));
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("bakes the Inertia home route to index.html through Hono SSG", async () => {
    const { bakeStaticHome } = await import("./static-home");

    const result = await bakeStaticHome({ dir: tempDir, version: "test-version" });
    const html = await readFile(path.join(tempDir, "index.html"), "utf8");

    expect(result.files.map((file) => file.replaceAll("\\", "/")).some((file) => file.endsWith("/index.html"))).toBe(
      true,
    );
    expect(result.html).toBe(html);
    expect(html).toContain("<title>Static Lab</title>");
    expect(html).toContain("Static Services");
    expect(html).toContain("Static App");
    expect(html).toContain("Static Bookmarks");
    expect(html).toContain("Static Link");
    expect(html).toContain('data-page="app"');
    expect(html).toContain('"version":"test-version"');
    expect(loadHomePageProps).toHaveBeenCalledTimes(1);
  });

  it("serves baked HTML only for browser home requests", async () => {
    const { StaticHomeCache } = await import("./static-home");
    const cache = new StaticHomeCache({
      dir: tempDir,
      enabled: true,
      logger: { info: vi.fn(), warn: vi.fn() },
      watch: false,
    });
    await cache.refresh("test");

    const app = new Hono();
    app.use("*", cache.middleware());
    app.get("/", (c) => c.text("dynamic"));

    const htmlResponse = await app.request("/", {
      headers: { accept: "text/html" },
    });
    expect(htmlResponse.headers.get("X-Daemun-Static-Home")).toBe("hit");
    expect(await htmlResponse.text()).toContain("<title>Static Lab</title>");

    const jsonResponse = await app.request("/", {
      headers: { accept: "application/json" },
    });
    expect(await jsonResponse.text()).toBe("dynamic");

    const queryResponse = await app.request("/?q=1", {
      headers: { accept: "text/html" },
    });
    expect(await queryResponse.text()).toBe("dynamic");
  });

  it("detects config file names that should refresh the baked page", async () => {
    const { isStaticHomeConfigFile } = await import("./static-home");

    expect(isStaticHomeConfigFile("services.yaml")).toBe(true);
    expect(isStaticHomeConfigFile("custom.css")).toBe(false);
    expect(isStaticHomeConfigFile("custom.js")).toBe(false);
    expect(isStaticHomeConfigFile("readme.txt")).toBe(false);
    expect(isStaticHomeConfigFile("")).toBe(true);
  });
});
