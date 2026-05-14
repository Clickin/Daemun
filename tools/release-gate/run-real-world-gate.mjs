import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scenariosPath = path.join(root, "tools/release-gate/real-world-scenarios.json");
const mib = 1024 * 1024;

// Keep this gate focused on Daemun contract/leak failures; dependency deprecation
// warnings are handled by normal lint/dependency maintenance, not smoke output.
process.noDeprecation = true;

function parseArgs() {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  const secondsArg = process.argv.find((arg) => arg.startsWith("--seconds="));
  const mode = modeArg?.split("=")[1] || "quick";

  if (!["quick", "soak"].includes(mode)) {
    throw new Error(`Unsupported real-world gate mode: ${mode}`);
  }

  const defaultSeconds = mode === "quick" ? 30 : 10 * 60;
  const envSeconds =
    mode === "quick" ? process.env.DAEMUN_REAL_WORLD_QUICK_SECONDS : process.env.DAEMUN_REAL_WORLD_SOAK_SECONDS;
  const seconds = Number(secondsArg?.split("=")[1] || envSeconds || defaultSeconds);
  const intervalMs = Number(process.env.DAEMUN_REAL_WORLD_INTERVAL_MS || 1000);
  const maxRssGrowthMiB = Number(
    mode === "quick"
      ? process.env.DAEMUN_REAL_WORLD_QUICK_MAX_RSS_GROWTH_MIB || 64
      : process.env.DAEMUN_REAL_WORLD_SOAK_MAX_RSS_GROWTH_MIB || 96,
  );

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Invalid real-world gate seconds: ${seconds}`);
  }

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid real-world gate interval: ${intervalMs}`);
  }

  return { intervalMs, maxRssGrowthMiB, mode, seconds };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jsonResponse(res, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(200, {
    "content-length": Buffer.byteLength(body),
    "content-type": "application/json",
  });
  res.end(body);
}

async function startGlancesMock() {
  let tick = 0;
  const server = createServer((req, res) => {
    tick += 1;
    const url = new URL(req.url, "http://mock.local");
    const endpoint = url.pathname.replace(/^\/api\/\d+\//, "");
    const drift = tick % 17;

    if (endpoint === "cpu") {
      jsonResponse(res, { total: 11 + drift });
      return;
    }

    if (endpoint === "load") {
      jsonResponse(res, { min1: 0.12 + drift / 100, min5: 0.2, min15: 0.33 });
      return;
    }

    if (endpoint === "mem") {
      jsonResponse(res, {
        available: 4_294_967_296 - drift * 1024,
        total: 8_589_934_592,
        percent: 50 + drift / 10,
      });
      return;
    }

    if (endpoint === "uptime") {
      jsonResponse(res, "2 days, 03:04:05");
      return;
    }

    if (endpoint === "sensors") {
      jsonResponse(res, [{ label: "cpu_thermal-0", type: "temperature_core", value: 41 + drift / 10, warning: 90 }]);
      return;
    }

    if (endpoint === "fs") {
      jsonResponse(res, [
        { free: 50_000_000_000 - drift, mnt_point: "/", percent: 51, size: 100_000_000_000 },
        { free: 750_000_000_000 - drift, mnt_point: "/data", percent: 25, size: 1_000_000_000_000 },
      ]);
      return;
    }

    jsonResponse(res, { error: `unknown endpoint: ${endpoint}` });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function writeFixtureConfig(configDir, glancesUrl) {
  await writeFile(
    path.join(configDir, "settings.yaml"),
    [
      "title: Daemun real-world gate",
      "theme: dark",
      "color: slate",
      "layout:",
      "  Services:",
      "    style: row",
      "",
    ].join("\n"),
  );

  await writeFile(
    path.join(configDir, "services.yaml"),
    [
      "- Services:",
      "    - Glances Resource Host:",
      `        href: ${glancesUrl}`,
      "        description: Mocked real-world metrics source",
      "        widget:",
      "          type: glances",
      `          url: ${glancesUrl}`,
      "",
    ].join("\n"),
  );

  await writeFile(
    path.join(configDir, "bookmarks.yaml"),
    "- Docs:\n    - Daemun:\n        - href: https://github.com/Clickin/Daemun\n",
  );
  await writeFile(path.join(configDir, "docker.yaml"), "");
  await writeFile(path.join(configDir, "kubernetes.yaml"), "");
  await writeFile(
    path.join(configDir, "widgets.yaml"),
    [
      "- glances:",
      `    url: ${glancesUrl}`,
      "    version: 4",
      "    label: Glances mock",
      "    cpu: true",
      "    mem: true",
      "    uptime: true",
      "    cputemp: true",
      "    disk:",
      "      - /",
      "      - /data",
      "- resources:",
      "    cpu: true",
      "    memory: true",
      "    uptime: true",
      "",
    ].join("\n"),
  );
}

async function createFixtureApp(configDir) {
  process.env.HOMEPAGE_ALLOWED_HOSTS = "localhost:3000";
  process.env.HOMEPAGE_CONFIG_DIR = configDir;
  process.env.LOG_TARGETS = "stdout";
  process.env.PORT = "3000";

  const appEntry = path.join(root, "dist/server/app.mjs");
  if (!existsSync(appEntry)) {
    throw new Error("dist/server/app.mjs is missing. Run `pnpm build` before real-world gates.");
  }

  const appModuleUrl = pathToFileURL(appEntry);
  appModuleUrl.search = `gate=${Date.now()}`;
  const { createApp } = await import(appModuleUrl.href);
  return createApp();
}

async function requestJson(app, route) {
  const response = await app.request(route, {
    headers: { accept: "application/json", host: "localhost:3000" },
  });

  if (!response.ok) {
    throw new Error(`${route} failed with HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function sampleRss() {
  return process.memoryUsage().rss;
}

function summarizeBytes(bytes) {
  return `${(bytes / mib).toFixed(2)} MiB`;
}

function assertPayloads(payloads) {
  if (!payloads.home.initialSettings?.title) {
    throw new Error("Home props did not include initial settings.");
  }
  if (!Array.isArray(payloads.widgets) || payloads.widgets.length < 2) {
    throw new Error("Widget config did not include the expected real-world fixtures.");
  }
  if (!payloads.glances.cpu || !payloads.glances.mem || !payloads.glances.fs) {
    throw new Error("Glances payload did not include cpu, mem, and fs data.");
  }
  if (
    !payloads.resourcesCpu.cpu ||
    !payloads.resourcesMemory.memory ||
    typeof payloads.resourcesUptime.uptime !== "number"
  ) {
    throw new Error("Resource payloads did not include cpu, memory, and uptime data.");
  }
}

async function runIteration(app) {
  const [home, widgets, glances, resourcesCpu, resourcesMemory, resourcesUptime] = await Promise.all([
    requestJson(app, "/"),
    requestJson(app, "/api/widgets"),
    requestJson(app, "/api/widgets/glances?index=0&version=4&uptime=1&cputemp=1&disk=1"),
    requestJson(app, "/api/widgets/resources?type=cpu"),
    requestJson(app, "/api/widgets/resources?type=memory"),
    requestJson(app, "/api/widgets/resources?type=uptime"),
  ]);

  const payloads = { glances, home, resourcesCpu, resourcesMemory, resourcesUptime, widgets };
  assertPayloads(payloads);
}

async function main() {
  const options = parseArgs();
  const scenarios = JSON.parse(await readFile(scenariosPath, "utf8"));
  const activeScenarios = scenarios.scenarios.filter((scenario) => scenario.modes.includes(options.mode));
  const configDir = await mkdtemp(path.join(os.tmpdir(), "daemun-real-world-"));
  const glancesMock = await startGlancesMock();
  const originalEnv = {
    allowedHosts: process.env.HOMEPAGE_ALLOWED_HOSTS,
    configDir: process.env.HOMEPAGE_CONFIG_DIR,
    logTargets: process.env.LOG_TARGETS,
    port: process.env.PORT,
  };

  try {
    await writeFixtureConfig(configDir, glancesMock.url);
    const app = await createFixtureApp(configDir);
    const startedAt = Date.now();
    const deadline = startedAt + options.seconds * 1000;
    let iterations = 0;
    let warmRss = 0;
    let peakRss = sampleRss();

    while (Date.now() < deadline || iterations === 0) {
      await runIteration(app);
      iterations += 1;
      const rss = sampleRss();
      peakRss = Math.max(peakRss, rss);
      if (iterations === 1) {
        warmRss = rss;
      }
      if (Date.now() < deadline) {
        await sleep(options.intervalMs);
      }
    }

    const endRss = sampleRss();
    const rssGrowth = Math.max(0, endRss - warmRss);
    const maxGrowthBytes = options.maxRssGrowthMiB * mib;

    if (rssGrowth > maxGrowthBytes) {
      throw new Error(
        `RSS grew by ${summarizeBytes(rssGrowth)} after warmup, above ${options.maxRssGrowthMiB} MiB threshold.`,
      );
    }

    console.log(
      [
        `Daemun real-world ${options.mode} gate passed.`,
        `scenarios=${activeScenarios.map((scenario) => scenario.id).join(",")}`,
        `duration=${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
        `iterations=${iterations}`,
        `warmRss=${summarizeBytes(warmRss)}`,
        `endRss=${summarizeBytes(endRss)}`,
        `peakRss=${summarizeBytes(peakRss)}`,
        `rssGrowth=${summarizeBytes(rssGrowth)}`,
      ].join(" "),
    );
  } finally {
    process.env.HOMEPAGE_ALLOWED_HOSTS = originalEnv.allowedHosts;
    process.env.HOMEPAGE_CONFIG_DIR = originalEnv.configDir;
    process.env.LOG_TARGETS = originalEnv.logTargets;
    process.env.PORT = originalEnv.port;
    await glancesMock.close();
    await rm(configDir, { force: true, recursive: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(`Daemun real-world gate failed: ${error.message}`);
  process.exit(1);
}
