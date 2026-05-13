import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadHomePageProps } = vi.hoisted(() => ({
  loadHomePageProps: vi.fn(async () => ({
    fallback: {
      "/api/bookmarks": [],
      "/api/hash": false,
      "/api/services": [],
      "/api/widgets": [],
    },
    initialSettings: { title: "Homepage" },
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

  it("renders the home page through Inertia", async () => {
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
        "/api/widgets": [],
      },
      initialSettings: { title: "Homepage" },
      locale: "en",
    });
  });

  it("serves the browser fallback favicon request", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/favicon.ico");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/x-icon");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
