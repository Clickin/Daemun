// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { rmSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { httpProxy } = vi.hoisted(() => ({
  httpProxy: vi.fn(async () => [200, "application/json", { color: "slate", theme: "dark" }]),
}));

vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));

vi.mock("utils/i18n", () => ({
  loadLanguage: vi.fn(async (language) => language),
}));

const fixtureConfigDir = path.resolve(process.cwd(), "src/test-utils/fixtures/smoke-config");
const fixtureLogsDir = path.join(fixtureConfigDir, "logs");

describe("browserless YAML/Hono/JSX smoke", () => {
  const originalEnv = {
    allowedHosts: process.env.HOMEPAGE_ALLOWED_HOSTS,
    configDir: process.env.HOMEPAGE_CONFIG_DIR,
    logTargets: process.env.LOG_TARGETS,
    port: process.env.PORT,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.documentElement.className = "";
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    localStorage.clear();
    rmSync(fixtureLogsDir, { recursive: true, force: true });
    process.env.HOMEPAGE_ALLOWED_HOSTS = "localhost:3000";
    process.env.HOMEPAGE_CONFIG_DIR = fixtureConfigDir;
    process.env.LOG_TARGETS = "stdout";
    process.env.PORT = "3000";
  });

  afterEach(() => {
    process.env.HOMEPAGE_ALLOWED_HOSTS = originalEnv.allowedHosts;
    process.env.HOMEPAGE_CONFIG_DIR = originalEnv.configDir;
    process.env.LOG_TARGETS = originalEnv.logTargets;
    process.env.PORT = originalEnv.port;
    rmSync(fixtureLogsDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  async function createFixtureApp() {
    const { createApp } = await import("./app");
    return createApp();
  }

  async function requestJson(app, path) {
    const response = await app.request(path, {
      headers: { accept: "application/json", host: "localhost:3000" },
    });
    expect(response.status).toBe(200);
    return response.json();
  }

  it("calls Hono directly and renders the configured dashboard without a bound port", async () => {
    const app = await createFixtureApp();

    const services = await requestJson(app, "/api/services");
    expect(JSON.stringify(services)).toContain("Widget Probe");

    const proxiedWidget = await requestJson(
      app,
      "/api/services/proxy?group=E2E%20Services&service=Widget%20Probe&index=0",
    );
    expect(proxiedWidget).toEqual({ color: "slate", theme: "dark" });
    expect(httpProxy).toHaveBeenCalledWith(
      new URL("http://fixture.local/theme"),
      expect.objectContaining({ method: "GET" }),
    );

    const pageProps = await requestJson(app, "/");
    expect(pageProps.initialSettings).toMatchObject({ title: "Daemun E2E", theme: "dark" });

    vi.stubGlobal("fetch", async (input, init) => {
      const rawUrl = typeof input === "string" ? input : input.url;
      const url = new URL(rawUrl, "http://localhost:3000");
      return app.request(url.pathname + url.search, {
        ...init,
        headers: { host: "localhost:3000", ...(init?.headers ?? {}) },
      });
    });

    const [{ AppProviders }, { default: Wrapper }] = await Promise.all([
      import("../app"),
      import("../pages/index.tsx"),
    ]);

    render(
      <AppProviders initialQueryData={pageProps.fallback} initialSettings={pageProps.initialSettings}>
        <Wrapper {...pageProps} />
      </AppProviders>,
    );

    expect(await screen.findByText("E2E Services")).toBeInTheDocument();
    expect(screen.getByText("E2E Bookmarks")).toBeInTheDocument();
    expect(screen.getByText("Widget Probe")).toBeInTheDocument();
    expect(screen.getByText("Custom API proxy smoke fixture")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.classList.contains("theme-slate")).toBe(true);
    });
  }, 15_000);
});
