import { randomUUID } from "node:crypto";
import { existsSync, type FSWatcher } from "node:fs";
import { mkdir, watch as watchConfigDir } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { toSSG } from "hono/ssg";

import { CONF_DIR } from "utils/config/config";

import { getAssetVersion } from "./build-info.ts";
import { loadHomePageProps } from "./home-props.ts";
import { renderHomeHtml } from "./render-home.tsx";
import { rootView } from "./root-view.ts";

const bakedHomeHeader = "X-Daemun-Static-Home";
const defaultBakeDir = path.resolve(process.env.DAEMUN_STATIC_HOME_DIR ?? path.join(process.cwd(), "dist/server/ssg"));
const watchedConfigPattern = /\.ya?ml$/i;

interface StaticHomeLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
}

interface StaticHomeCacheOptions {
  dir?: string;
  enabled?: boolean;
  logger?: StaticHomeLogger;
  watch?: boolean;
}

interface StaticHomeBakeOptions {
  dir?: string;
  version?: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isFsError(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

async function createBakeStagingDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
  await cleanupStaleBakeStagingDirs(dir);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const stagingDir = path.join(dir, `.bake-${process.pid}-${randomUUID()}`);
    try {
      await fs.mkdir(stagingDir, { recursive: false });
      return stagingDir;
    } catch (error) {
      if (isFsError(error, "EEXIST")) continue;
      throw error;
    }
  }

  throw new Error("Could not create a unique static home staging directory");
}

async function cleanupStaleBakeStagingDirs(dir: string) {
  const entries = await fs.readdir(dir).catch((error) => {
    if (isFsError(error, "ENOENT")) return [];
    throw error;
  });

  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(".bake-"))
      .map((entry) => fs.rm(path.join(dir, entry), { force: true, recursive: true }).catch(() => undefined)),
  );
}

type ActiveStaticHomeCache = Pick<StaticHomeCache, "refresh">;

let activeStaticHomeCache: ActiveStaticHomeCache | null = null;

function createStaticHomeApp(version = getAssetVersion()) {
  const app = new Hono();
  let propsPromise: ReturnType<typeof loadHomePageProps> | null = null;

  app.get("/", async (c) => {
    const props = await (propsPromise ??= loadHomePageProps());

    return c.html(
      rootView(
        {
          component: "Home",
          props,
          url: "/",
          version,
        },
        { appHtml: renderHomeHtml(props) },
      ),
    );
  });

  return app;
}

function isBrowserHomeRequest(c: Context) {
  if (c.req.method !== "GET") return false;
  if (c.req.header("X-Inertia")) return false;

  const url = new URL(c.req.url);
  if (url.pathname !== "/" || url.search) return false;

  const accept = c.req.header("Accept") || "";
  return !accept.includes("application/json");
}

export function isStaticHomeConfigFile(filename?: string) {
  return !filename || watchedConfigPattern.test(filename);
}

export async function bakeStaticHome({
  dir = defaultBakeDir,
  version = getAssetVersion(),
}: StaticHomeBakeOptions = {}) {
  let stagingDir: string | null = null;

  try {
    stagingDir = await createBakeStagingDir(dir);

    const result = await toSSG(createStaticHomeApp(version), fs, {
      concurrency: 1,
      dir: stagingDir,
    });

    if (!result.success) {
      throw result.error ?? new Error("Static home generation failed");
    }

    const stagingIndex = path.join(stagingDir, "index.html");
    const html = await fs.readFile(stagingIndex, "utf8");
    if (html.length === 0) {
      throw new Error("Static home generation produced an empty index.html");
    }

    const filePath = path.join(dir, "index.html");
    await fs.rename(stagingIndex, filePath);

    return {
      filePath,
      files: result.files.map((file) => {
        const relativePath = path.relative(stagingDir, file);
        return relativePath.startsWith("..") || path.isAbsolute(relativePath) ? file : path.join(dir, relativePath);
      }),
      html,
    };
  } finally {
    if (stagingDir) {
      await fs.rm(stagingDir, { force: true, recursive: true }).catch(() => undefined);
    }
  }
}

export class StaticHomeCache {
  dir: string;
  enabled: boolean;
  html: string | null;
  logger: StaticHomeLogger;
  queuedRefreshReason: string | null;
  refreshPromise: Promise<boolean> | null;
  timer: ReturnType<typeof setTimeout> | null;
  version: string;
  watchEnabled: boolean;
  watcher: FSWatcher | null;

  constructor({
    dir = defaultBakeDir,
    enabled = process.env.NODE_ENV === "production" && process.env.DAEMUN_STATIC_HOME !== "0",
    logger = console,
    watch = enabled && process.env.DAEMUN_STATIC_HOME_WATCH !== "0",
  }: StaticHomeCacheOptions = {}) {
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
    this.queuedRefreshReason = reason;
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.drainRefreshQueue();

    return this.refreshPromise;
  }

  private async drainRefreshQueue() {
    let lastResult = false;

    try {
      while (this.queuedRefreshReason) {
        const reason = this.queuedRefreshReason;
        this.queuedRefreshReason = null;

        lastResult = await bakeStaticHome({ dir: this.dir, version: this.version })
          .then(({ html }) => {
            this.html = html;
            this.logger.info?.(`Static home baked (${reason})`);
            return true;
          })
          .catch((error) => {
            this.logger.warn?.(`Static home bake failed (${reason}): ${errorMessage(error)}`);
            return false;
          });
      }

      return lastResult;
    } finally {
      this.refreshPromise = null;
    }
  }

  scheduleRefresh(reason: string) {
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
          this.logger.warn?.(`Static home watcher failed: ${errorMessage(error)}`);
        });
        this.watcher.unref?.();
      } catch (error) {
        this.logger.warn?.(`Static home watcher could not start: ${errorMessage(error)}`);
      }
    });
  }

  middleware() {
    return async (c: Context, next: Next) => {
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

export function createStaticHomeCache(options?: StaticHomeCacheOptions) {
  return new StaticHomeCache(options);
}

export function setStaticHomeCache(cache: ActiveStaticHomeCache | null) {
  activeStaticHomeCache = cache;
}

export async function refreshStaticHome(reason = "manual") {
  if (!activeStaticHomeCache) return false;
  return activeStaticHomeCache.refresh(reason);
}

export async function readBakedStaticHome(filePath = path.join(defaultBakeDir, "index.html")) {
  return fs.readFile(filePath, "utf8");
}
