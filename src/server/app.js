import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { inertia } from "@hono/inertia";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import bookmarks from "../pages/api/bookmarks.js";
import configFile from "../pages/api/config/[path].js";
import dockerStats from "../pages/api/docker/stats/[...service].js";
import dockerStatus from "../pages/api/docker/status/[...service].js";
import hash from "../pages/api/hash.js";
import healthcheck from "../pages/api/healthcheck.js";
import kubernetesStats from "../pages/api/kubernetes/stats/[...service].js";
import kubernetesStatus from "../pages/api/kubernetes/status/[...service].js";
import ping from "../pages/api/ping.js";
import proxmoxStats from "../pages/api/proxmox/stats/[...service].js";
import releases from "../pages/api/releases.js";
import revalidate from "../pages/api/revalidate.js";
import searchSuggestion from "../pages/api/search/searchSuggestion.js";
import services from "../pages/api/services/index.js";
import servicesProxy from "../pages/api/services/proxy.js";
import siteMonitor from "../pages/api/siteMonitor.js";
import theme from "../pages/api/theme.js";
import validate from "../pages/api/validate.js";
import widgetsGlances from "../pages/api/widgets/glances.js";
import widgets from "../pages/api/widgets/index.js";
import widgetsKubernetes from "../pages/api/widgets/kubernetes.js";
import widgetsLonghorn from "../pages/api/widgets/longhorn.js";
import widgetsOpenmeteo from "../pages/api/widgets/openmeteo.js";
import widgetsOpenweathermap from "../pages/api/widgets/openweathermap.js";
import widgetsResources from "../pages/api/widgets/resources.js";
import widgetsStocks from "../pages/api/widgets/stocks.js";
import widgetsWeather from "../pages/api/widgets/weather.js";

import { getAssetVersion } from "./build-info.js";
import { loadHomePageProps } from "./home-props.js";
import { honoNextApiHandler, splitCatchAll } from "./next-api-adapter.js";
import { rootView } from "./root-view.js";
import { browserConfigXml, robotsTxt, siteWebmanifest } from "./static-pages.js";

function apiHostValidation() {
  return async (c, next) => {
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

const catchAllService = (c) => ({ service: splitCatchAll(c.req.param("*")) });

export function createApp() {
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

  app.get("/api/bookmarks", honoNextApiHandler(bookmarks));
  app.get("/api/hash", honoNextApiHandler(hash));
  app.get("/api/healthcheck", honoNextApiHandler(healthcheck));
  app.get("/api/ping", honoNextApiHandler(ping));
  app.get("/api/releases", honoNextApiHandler(releases));
  app.all("/api/revalidate", honoNextApiHandler(revalidate));
  app.get("/api/siteMonitor", honoNextApiHandler(siteMonitor));
  app.get("/api/theme", honoNextApiHandler(theme));
  app.get("/api/validate", honoNextApiHandler(validate));
  app.get(
    "/api/config/:path",
    honoNextApiHandler(configFile, (c) => ({ path: c.req.param("path") })),
  );
  app.all("/api/services/proxy", honoNextApiHandler(servicesProxy));
  app.get("/api/services", honoNextApiHandler(services));
  app.get("/api/search/searchSuggestion", honoNextApiHandler(searchSuggestion));
  app.get("/api/widgets/glances", honoNextApiHandler(widgetsGlances));
  app.get("/api/widgets/kubernetes", honoNextApiHandler(widgetsKubernetes));
  app.get("/api/widgets/longhorn", honoNextApiHandler(widgetsLonghorn));
  app.get("/api/widgets/openmeteo", honoNextApiHandler(widgetsOpenmeteo));
  app.get("/api/widgets/openweathermap", honoNextApiHandler(widgetsOpenweathermap));
  app.get("/api/widgets/resources", honoNextApiHandler(widgetsResources));
  app.get("/api/widgets/stocks", honoNextApiHandler(widgetsStocks));
  app.get("/api/widgets/weather", honoNextApiHandler(widgetsWeather));
  app.get("/api/widgets", honoNextApiHandler(widgets));
  app.get("/api/docker/status/*", honoNextApiHandler(dockerStatus, catchAllService));
  app.get("/api/docker/stats/*", honoNextApiHandler(dockerStats, catchAllService));
  app.get("/api/kubernetes/status/*", honoNextApiHandler(kubernetesStatus, catchAllService));
  app.get("/api/kubernetes/stats/*", honoNextApiHandler(kubernetesStats, catchAllService));
  app.get("/api/proxmox/stats/*", honoNextApiHandler(proxmoxStats, catchAllService));

  app.get("/browserconfig.xml", (c) => c.body(browserConfigXml(), 200, { "content-type": "text/xml" }));
  app.get("/favicon.ico", (c) =>
    c.body(readFileSync(path.join(publicRoot, "homepage.ico")), 200, { "content-type": "image/x-icon" }),
  );
  app.get("/robots.txt", (c) => c.body(robotsTxt(), 200, { "content-type": "text/plain" }));
  app.get("/site.webmanifest", (c) => c.json(siteWebmanifest(), 200, { "content-type": "application/manifest+json" }));

  app.get("/", async (c) => c.render("Home", await loadHomePageProps()));

  if (existsSync(clientRoot)) {
    app.use("/assets/*", serveStatic({ root: clientRoot }));
  }
  app.use("/locales/*", serveStatic({ root: publicRoot }));
  app.use("*", serveStatic({ root: publicRoot }));

  return app;
}

export default createApp();
