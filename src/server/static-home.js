import { existsSync } from "node:fs";
import { mkdir, watch as watchConfigDir } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { Hono } from "hono";
import { toSSG } from "hono/ssg";

import { CONF_DIR } from "utils/config/config";

import { getAssetVersion } from "./build-info.js";
import { loadHomePageProps } from "./home-props.js";
import { rootView } from "./root-view.js";

const bakedHomeHeader = "X-Daemun-Static-Home";
const defaultBakeDir = path.resolve(process.cwd(), "dist/server/ssg");
const watchedConfigPattern = /\.(ya?ml|css|js)$/i;

let activeStaticHomeCache = null;

function createStaticHomeApp(version = getAssetVersion()) {
  const app = new Hono();
  let propsPromise = null;

  app.get("/", async (c) =>
    c.html(
      rootView({
        component: "Home",
        props: await (propsPromise ??= loadHomePageProps()),
        url: "/",
        version,
      }),
    ),
  );

  return app;
}

function isBrowserHomeRequest(c) {
  if (c.req.method !== "GET") return false;
  if (c.req.header("X-Inertia")) return false;

  const url = new URL(c.req.url);
  if (url.pathname !== "/" || url.search) return false;

  const accept = c.req.header("Accept") || "";
  return !accept.includes("application/json");
}

export function isStaticHomeConfigFile(filename) {
  return !filename || watchedConfigPattern.test(filename);
}

export async function bakeStaticHome({ dir = defaultBakeDir, version = getAssetVersion() } = {}) {
  await fs.rm(dir, { force: true, recursive: true });

  const result = await toSSG(createStaticHomeApp(version), fs, {
    concurrency: 1,
    dir,
  });

  if (!result.success) {
    throw result.error ?? new Error("Static home generation failed");
  }

  const filePath = path.join(dir, "index.html");
  return {
    filePath,
    files: result.files,
    html: await fs.readFile(filePath, "utf8"),
  };
}

export class StaticHomeCache {
  constructor({
    dir = defaultBakeDir,
    enabled = process.env.NODE_ENV === "production" && process.env.DAEMUN_STATIC_HOME !== "0",
    logger = console,
    watch = enabled && process.env.DAEMUN_STATIC_HOME_WATCH !== "0",
  } = {}) {
    this.dir = dir;
    this.enabled = enabled;
    this.html = null;
    this.logger = logger;
    this.queuedRefreshReason = null;
    this.refreshPromise = null;
    this.timer = null;
    this.version = getAssetVersion();
    this.watchEnabled = watch;
    this.watcher = null;
  }

  async start() {
    if (!this.enabled) return false;

    await this.refresh("startup");
    if (this.watchEnabled) {
      this.startWatcher();
    }
    return Boolean(this.html);
  }

  async refresh(reason = "manual") {
    if (!this.enabled) return false;
    if (this.refreshPromise) {
      this.queuedRefreshReason = reason;
      return this.refreshPromise;
    }

    this.refreshPromise = bakeStaticHome({ dir: this.dir, version: this.version })
      .then(({ html }) => {
        this.html = html;
        this.logger.info?.(`Static home baked (${reason})`);
        return true;
      })
      .catch((error) => {
        this.logger.warn?.(`Static home bake failed (${reason}): ${error.message}`);
        return false;
      })
      .finally(() => {
        this.refreshPromise = null;
        const queuedReason = this.queuedRefreshReason;
        this.queuedRefreshReason = null;
        if (queuedReason) {
          this.scheduleRefresh(queuedReason);
        }
      });

    return this.refreshPromise;
  }

  scheduleRefresh(reason) {
    if (!this.enabled) return;
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh(reason);
    }, 250);
    this.timer.unref?.();
  }

  startWatcher() {
    if (this.watcher) return;

    mkdir(CONF_DIR, { recursive: true }, (mkdirError) => {
      if (mkdirError) {
        this.logger.warn?.(`Static home watcher could not create config directory: ${mkdirError.message}`);
        return;
      }

      if (!existsSync(CONF_DIR)) return;

      try {
        this.watcher = watchConfigDir(CONF_DIR, (_event, filename) => {
          const changedFile = filename ? String(filename) : "";
          if (isStaticHomeConfigFile(changedFile)) {
            this.scheduleRefresh(changedFile || "config");
          }
        });
        this.watcher.on("error", (error) => {
          this.logger.warn?.(`Static home watcher failed: ${error.message}`);
        });
        this.watcher.unref?.();
      } catch (error) {
        this.logger.warn?.(`Static home watcher could not start: ${error.message}`);
      }
    });
  }

  middleware() {
    return async (c, next) => {
      if (this.html && isBrowserHomeRequest(c)) {
        return c.html(this.html, 200, { [bakedHomeHeader]: "hit" });
      }

      return next();
    };
  }

  close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.watcher?.close();
    this.watcher = null;
  }
}

export function createStaticHomeCache(options) {
  return new StaticHomeCache(options);
}

export function setStaticHomeCache(cache) {
  activeStaticHomeCache = cache;
}

export async function refreshStaticHome(reason = "manual") {
  if (!activeStaticHomeCache) return false;
  return activeStaticHomeCache.refresh(reason);
}

export async function readBakedStaticHome(filePath = path.join(defaultBakeDir, "index.html")) {
  return fs.readFile(filePath, "utf8");
}
