import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Context, MiddlewareHandler, Next } from "hono";

import bookmarks from "../pages/api/bookmarks.ts";
import configFile from "../pages/api/config/[path].ts";
import dockerStats from "../pages/api/docker/stats/[...service].ts";
import dockerStatus from "../pages/api/docker/status/[...service].ts";
import hash from "../pages/api/hash.ts";
import healthcheck from "../pages/api/healthcheck.ts";
import kubernetesStats from "../pages/api/kubernetes/stats/[...service].ts";
import kubernetesStatus from "../pages/api/kubernetes/status/[...service].ts";
import ping from "../pages/api/ping.ts";
import proxmoxStats from "../pages/api/proxmox/stats/[...service].ts";
import releases from "../pages/api/releases.ts";
import revalidate from "../pages/api/revalidate.ts";
import searchSuggestion from "../pages/api/search/searchSuggestion.ts";
import services from "../pages/api/services/index.ts";
import servicesProxy from "../pages/api/services/proxy.ts";
import siteMonitor from "../pages/api/siteMonitor.ts";
import theme from "../pages/api/theme.ts";
import validate from "../pages/api/validate.ts";
import widgetsGlances from "../pages/api/widgets/glances.ts";
import widgets from "../pages/api/widgets/index.ts";
import widgetsKubernetes from "../pages/api/widgets/kubernetes.ts";
import widgetsLonghorn from "../pages/api/widgets/longhorn.ts";
import widgetsOpenmeteo from "../pages/api/widgets/openmeteo.ts";
import widgetsOpenweathermap from "../pages/api/widgets/openweathermap.ts";
import widgetsResources from "../pages/api/widgets/resources.ts";
import widgetsStocks from "../pages/api/widgets/stocks.ts";
import widgetsWeather from "../pages/api/widgets/weather.ts";

import { getAssetVersion } from "./build-info.ts";
import { loadHomePageProps } from "./home-props.ts";
import { honoApiHandler, splitCatchAll } from "./api-handler-adapter.ts";
import { inertia } from "./inertia.ts";
import { rootView } from "./root-view.ts";
import { browserConfigXml, robotsTxt, siteWebmanifest } from "./static-pages.ts";

function apiHostValidation() {
  return async (c: Context, next: Next) => {
    const host = c.req.header("host");
    const port = process.env.PORT || 3000;
    let allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`];
    const allowAll = process.env.HOMEPAGE_ALLOWED_HOSTS === "*";

    if (process.env.HOMEPAGE_ALLOWED_HOSTS) {
      allowedHosts = allowedHosts.concat(process.env.HOMEPAGE_ALLOWED_HOSTS.split(","));
    }

    if (!allowAll && (!host || !allowedHosts.includes(host))) {
      console.error(
        `Host validation failed for: ${host}. Hint: Set the HOMEPAGE_ALLOWED_HOSTS environment variable to allow requests from this host / port.`,
      );
      return c.json({ error: "Host validation failed. See logs for more details." }, 400);
    }

    return next();
  };
}

const catchAllService = (c: Context) => ({ service: splitCatchAll(c.req.param("*")) });

interface CreateAppOptions {
  staticHome?: { middleware(): MiddlewareHandler };
}

export function createApp({ staticHome }: CreateAppOptions = {}) {
  const app = new Hono();
  const publicRoot = path.resolve(process.cwd(), "public");
  const clientRoot = path.resolve(process.cwd(), "dist/client");

  app.use("/api/*", apiHostValidation());

  app.use(
    inertia({
      rootView,
      version: getAssetVersion(),
    }),
  );

  app.get("/api/bookmarks", honoApiHandler(bookmarks));
  app.get("/api/hash", honoApiHandler(hash));
  app.get("/api/healthcheck", honoApiHandler(healthcheck));
  app.get("/api/ping", honoApiHandler(ping));
  app.get("/api/releases", honoApiHandler(releases));
  app.all("/api/revalidate", honoApiHandler(revalidate));
  app.get("/api/siteMonitor", honoApiHandler(siteMonitor));
  app.get("/api/theme", honoApiHandler(theme));
  app.get("/api/validate", honoApiHandler(validate));
  app.get(
    "/api/config/:path",
    honoApiHandler(configFile, (c) => ({ path: c.req.param("path") })),
  );
  app.all("/api/services/proxy", honoApiHandler(servicesProxy));
  app.get("/api/services", honoApiHandler(services));
  app.get("/api/search/searchSuggestion", honoApiHandler(searchSuggestion));
  app.get("/api/widgets/glances", honoApiHandler(widgetsGlances));
  app.get("/api/widgets/kubernetes", honoApiHandler(widgetsKubernetes));
  app.get("/api/widgets/longhorn", honoApiHandler(widgetsLonghorn));
  app.get("/api/widgets/openmeteo", honoApiHandler(widgetsOpenmeteo));
  app.get("/api/widgets/openweathermap", honoApiHandler(widgetsOpenweathermap));
  app.get("/api/widgets/resources", honoApiHandler(widgetsResources));
  app.get("/api/widgets/stocks", honoApiHandler(widgetsStocks));
  app.get("/api/widgets/weather", honoApiHandler(widgetsWeather));
  app.get("/api/widgets", honoApiHandler(widgets));
  app.get("/api/docker/status/*", honoApiHandler(dockerStatus, catchAllService));
  app.get("/api/docker/stats/*", honoApiHandler(dockerStats, catchAllService));
  app.get("/api/kubernetes/status/*", honoApiHandler(kubernetesStatus, catchAllService));
  app.get("/api/kubernetes/stats/*", honoApiHandler(kubernetesStats, catchAllService));
  app.get("/api/proxmox/stats/*", honoApiHandler(proxmoxStats, catchAllService));

  app.get("/browserconfig.xml", (c) => c.body(browserConfigXml(), 200, { "content-type": "text/xml" }));
  app.get("/favicon.ico", (c) =>
    c.body(readFileSync(path.join(publicRoot, "daemun.ico")), 200, { "content-type": "image/x-icon" }),
  );
  app.get("/robots.txt", (c) => c.body(robotsTxt(), 200, { "content-type": "text/plain" }));
  app.get("/site.webmanifest", (c) => c.json(siteWebmanifest(), 200, { "content-type": "application/manifest+json" }));

  if (staticHome) {
    app.use("*", staticHome.middleware());
  }

  app.get("/", async (c) =>
    (c.render as (component: string, props: unknown) => Response | Promise<Response>)("Home", await loadHomePageProps()),
  );

  if (existsSync(clientRoot)) {
    app.use("/assets/*", serveStatic({ root: clientRoot }));
  }
  app.use("/locales/*", serveStatic({ root: publicRoot }));
  app.use("*", serveStatic({ root: publicRoot }));

  return app;
}

export default createApp();
