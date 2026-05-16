import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadHomePageProps } = vi.hoisted(() => ({
  loadHomePageProps: vi.fn<VitestMockProcedure>(async () => ({
    fallback: {
      "/api/bookmarks": [],
      "/api/hash": false,
      "/api/services": [],
      "/api/validate": [],
      "/api/widgets": [],
    },
    initialSettings: { title: "Daemun" },
    locale: "en",
  })),
}));

vi.mock("./home-props", () => ({
  loadHomePageProps,
}));

describe("Hono app", () => {
  const originalAllowedHosts = process.env.HOMEPAGE_ALLOWED_HOSTS;
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.HOMEPAGE_ALLOWED_HOSTS = originalAllowedHosts;
  });

  afterEach(() => {
    consoleError?.mockRestore();
  });

  it("serves existing API handlers through the Hono route table", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/api/healthcheck", {
      headers: { host: "localhost:3000" },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("up");
  }, 10000);

  it("keeps HOMEPAGE_ALLOWED_HOSTS validation on /api routes", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/api/healthcheck", {
      headers: { host: "evil.example" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Host validation failed. See logs for more details." });
  });

  it("renders the home page through raw Hono JSON for API-style requests", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/", {
      headers: { accept: "application/json" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      fallback: {
        "/api/bookmarks": [],
        "/api/hash": false,
        "/api/services": [],
        "/api/validate": [],
        "/api/widgets": [],
      },
      initialSettings: { title: "Daemun" },
      locale: "en",
    });
  });

  it("renders browser home HTML without Inertia response headers", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/", {
      headers: { accept: "text/html" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Inertia")).toBeNull();
    expect(response.headers.get("X-Inertia-Location")).toBeNull();
    const html = await response.text();
    expect(html).toContain("<title>Daemun</title>");
    expect(html).toContain('id="daemun-page-props"');
    expect(html).toContain('id="daemun-query-data"');
    expect(html).not.toContain('data-page="app"');
  });

  it("serves the browser fallback favicon request", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/favicon.ico");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/x-icon");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("serves static compatibility payloads without Next pages", async () => {
    const { createApp } = await import("./app");
    const app = createApp();

    const robots = await app.request("/robots.txt");
    expect(robots.status).toBe(200);
    expect(robots.headers.get("content-type")).toContain("text/plain");
    expect(await robots.text()).toContain("User-agent: *");

    const browserConfig = await app.request("/browserconfig.xml");
    expect(browserConfig.status).toBe(200);
    expect(browserConfig.headers.get("content-type")).toContain("text/xml");
    expect(await browserConfig.text()).toContain("<browserconfig>");

    const manifest = await app.request("/site.webmanifest");
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("content-type")).toContain("application/manifest+json");
    expect(await manifest.json()).toMatchObject({
      display: "standalone",
      start_url: "/",
    });
  });
});
