import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadHomePageProps, staticHomeProps } = vi.hoisted(() => {
  const staticHomeProps = {
    fallback: {
      "/api/bookmarks": [
        {
          bookmarks: [{ description: "Static bookmark description", href: "https://example.com", name: "Static Link" }],
          name: "Static Bookmarks",
        },
      ],
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
  };

  return {
    loadHomePageProps: vi.fn<VitestMockProcedure>(async () => staticHomeProps),
    staticHomeProps,
  };
});

vi.mock("./home-props", () => ({
  loadHomePageProps,
}));

vi.mock("./render-home.tsx", () => ({
  renderHomeHtml: vi.fn<VitestMockProcedure>(() => "<main>static home</main>"),
}));

vi.mock("utils/i18n", () => ({
  default: { changeLanguage: vi.fn<VitestMockProcedure>(), language: "en" },
  loadLanguage: vi.fn<VitestMockProcedure>(async (language) => language),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

describe("static home SSG cache", () => {
  let tempDir;

  beforeEach(() => {
    vi.clearAllMocks();
    tempDir = mkdtempSync(path.join(os.tmpdir(), "daemun-static-home-"));
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("bakes the raw Hono home route to index.html through Hono SSG", async () => {
    const { bakeStaticHome } = await import("./static-home");

    const result = await bakeStaticHome({ dir: tempDir });
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
    expect(html).toContain('id="daemun-page-props"');
    expect(html).toContain('id="daemun-query-data"');
    expect(html).not.toContain('data-page="app"');
    expect(html).not.toContain('"component":"Home"');
    expect(loadHomePageProps).toHaveBeenCalledTimes(1);
  });

  it("uses DAEMUN_STATIC_HOME_DIR as the default bake directory", async () => {
    const originalStaticHomeDir = process.env.DAEMUN_STATIC_HOME_DIR;
    const runtimeDir = path.join(tempDir, "runtime-ssg");
    process.env.DAEMUN_STATIC_HOME_DIR = runtimeDir;
    vi.resetModules();

    try {
      const { bakeStaticHome } = await import("./static-home");

      const result = await bakeStaticHome();

      expect(result.filePath).toBe(path.join(runtimeDir, "index.html"));
      await expect(readFile(path.join(runtimeDir, "index.html"), "utf8")).resolves.toBe(result.html);
    } finally {
      if (originalStaticHomeDir === undefined) {
        delete process.env.DAEMUN_STATIC_HOME_DIR;
      } else {
        process.env.DAEMUN_STATIC_HOME_DIR = originalStaticHomeDir;
      }
      vi.resetModules();
    }
  });

  it("keeps the nginx static root aligned with the runtime bake directory", async () => {
    const entrypoint = await readFile(path.resolve(process.cwd(), "nginx-docker/entrypoint.sh"), "utf8");
    const nginxConfig = await readFile(path.resolve(process.cwd(), "nginx-docker/nginx.conf"), "utf8");

    expect(entrypoint).toContain("STATIC_HOME_DIR=/tmp/daemun/ssg");
    expect(entrypoint).toContain('export DAEMUN_STATIC_HOME_DIR="$STATIC_HOME_DIR"');
    expect(entrypoint).toContain('STATIC_INDEX="$STATIC_HOME_DIR/index.html"');
    expect(nginxConfig).toContain("charset utf-8;");
    expect(nginxConfig).toContain("tcp_nopush on;");
    expect(nginxConfig).toContain("tcp_nodelay on;");
    expect(nginxConfig).toContain('add_header Cache-Control "no-cache" always;');
    expect(nginxConfig).not.toContain('add_header Cache-Control "no-store"');
    expect(nginxConfig).toContain("root /tmp/daemun/ssg;");
    expect(nginxConfig).toContain("location /api/");
    expect(nginxConfig).toContain("root /app/public;");
    expect(nginxConfig).toContain("location /assets/");
    expect(nginxConfig).toContain("alias /app/dist/client/assets/;");
    expect(nginxConfig).toContain('add_header Cache-Control "public, max-age=31536000, immutable";');
  });

  it("keeps runtime config and static directories writable after dropping privileges", async () => {
    const dockerEntrypoint = await readFile(path.resolve(process.cwd(), "docker-entrypoint.sh"), "utf8");
    const nginxEntrypoint = await readFile(path.resolve(process.cwd(), "nginx-docker/entrypoint.sh"), "utf8");

    for (const entrypoint of [dockerEntrypoint, nginxEntrypoint]) {
      expect(entrypoint).toContain("CONFIG_DIR=$(readlink -f /app/config");
      expect(entrypoint).toContain('chown -R "$PUID:$PGID" "$CONFIG_DIR"');
      expect(entrypoint).toContain('chown "$PUID:$PGID" "$STATIC_HOME_DIR"');
    }

    expect(nginxEntrypoint).toContain('chown "$PUID:$PGID" /run/daemun');
  });

  it("keeps the existing index.html when a bake fails", async () => {
    const { bakeStaticHome } = await import("./static-home");
    const existingHtml = "<!doctype html><title>existing snapshot</title>";
    await writeFile(path.join(tempDir, "index.html"), existingHtml);
    loadHomePageProps.mockRejectedValueOnce(new Error("bake boom"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(bakeStaticHome({ dir: tempDir })).rejects.toThrow();
    } finally {
      consoleError.mockRestore();
    }

    await expect(readFile(path.join(tempDir, "index.html"), "utf8")).resolves.toBe(existingHtml);
    const entries = await readdir(tempDir);
    expect(entries.filter((entry) => entry.startsWith(".bake-"))).toEqual([]);
  });

  it("replaces only index.html after a successful bake", async () => {
    const { bakeStaticHome } = await import("./static-home");
    const sentinelPath = path.join(tempDir, "sentinel.txt");
    await writeFile(path.join(tempDir, "index.html"), "<!doctype html><title>old snapshot</title>");
    await writeFile(sentinelPath, "keep me");

    const result = await bakeStaticHome({ dir: tempDir });

    await expect(readFile(sentinelPath, "utf8")).resolves.toBe("keep me");
    expect(result.html).toContain("<title>Static Lab</title>");
    expect(result.html).not.toContain('data-page="app"');
    await expect(readFile(path.join(tempDir, "index.html"), "utf8")).resolves.toBe(result.html);
    const entries = await readdir(tempDir);
    expect(entries.filter((entry) => entry.startsWith(".bake-"))).toEqual([]);
  });

  it("removes stale bake staging directories before writing a fresh snapshot", async () => {
    const { bakeStaticHome } = await import("./static-home");
    const staleDir = path.join(tempDir, ".bake-123-stale");
    await writeFile(path.join(tempDir, "index.html"), "<!doctype html><title>existing snapshot</title>");
    await mkdir(staleDir);
    await writeFile(path.join(staleDir, "index.html"), "<!doctype html><title>stale staging</title>");

    await bakeStaticHome({ dir: tempDir });

    const entries = await readdir(tempDir);
    expect(entries.filter((entry) => entry.startsWith(".bake-"))).toEqual([]);
  });

  it("serves baked HTML only for browser home requests", async () => {
    const { StaticHomeCache } = await import("./static-home");
    const cache = new StaticHomeCache({
      dir: tempDir,
      enabled: true,
      logger: { info: vi.fn<VitestMockProcedure>(), warn: vi.fn<VitestMockProcedure>() },
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

  it("runs one follow-up bake after a refresh is queued during an active bake", async () => {
    const { StaticHomeCache } = await import("./static-home");
    const firstProps = deferred<Awaited<ReturnType<typeof loadHomePageProps>>>();
    const secondProps = deferred<Awaited<ReturnType<typeof loadHomePageProps>>>();
    let activeLoads = 0;
    let maxActiveLoads = 0;
    loadHomePageProps
      .mockImplementationOnce(async () => {
        activeLoads += 1;
        maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
        try {
          return await firstProps.promise;
        } finally {
          activeLoads -= 1;
        }
      })
      .mockImplementationOnce(async () => {
        activeLoads += 1;
        maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
        try {
          return await secondProps.promise;
        } finally {
          activeLoads -= 1;
        }
      });
    const cache = new StaticHomeCache({
      dir: tempDir,
      enabled: true,
      logger: { info: vi.fn<VitestMockProcedure>(), warn: vi.fn<VitestMockProcedure>() },
      watch: false,
    });

    const firstRefresh = cache.refresh("first");
    await vi.waitFor(() => expect(loadHomePageProps).toHaveBeenCalledTimes(1));
    const queuedRefresh = cache.refresh("second");
    let queuedRefreshSettled = false;
    void queuedRefresh.then(() => {
      queuedRefreshSettled = true;
    });
    firstProps.resolve(staticHomeProps);
    await vi.waitFor(() => expect(loadHomePageProps).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(queuedRefreshSettled).toBe(false);
    secondProps.resolve(staticHomeProps);

    await expect(firstRefresh).resolves.toBe(true);
    await expect(queuedRefresh).resolves.toBe(true);
    expect(queuedRefreshSettled).toBe(true);
    expect(loadHomePageProps).toHaveBeenCalledTimes(2);
    expect(maxActiveLoads).toBe(1);
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
