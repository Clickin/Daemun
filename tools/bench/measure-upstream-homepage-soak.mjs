import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const mib = 1024 * 1024;

function parseArgs() {
  const args = new Map(
    process.argv
      .slice(2)
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, ...value] = arg.slice(2).split("=");
        return [key, value.join("=") || "true"];
      }),
  );

  const upstreamDir = args.get("upstream-dir");
  if (!upstreamDir) {
    throw new Error("Missing --upstream-dir=<path>.");
  }

  return {
    intervalMs: Number(args.get("interval-ms") || 1000),
    seconds: Number(args.get("seconds") || 10 * 60),
    upstreamDir: path.resolve(upstreamDir),
  };
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
        percent: 50 + drift / 10,
        total: 8_589_934_592,
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

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function writeFixtureConfig(configDir, glancesUrl) {
  await writeFile(
    path.join(configDir, "settings.yaml"),
    [
      "title: Homepage upstream soak",
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
    "- Docs:\n    - Homepage:\n        - href: https://gethomepage.dev/\n",
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

function workingSetBytes(pid) {
  if (process.platform !== "win32") {
    const status = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" });
    if (status.status !== 0) {
      throw new Error(`Failed to sample RSS for pid ${pid}: ${status.stderr.trim()}`);
    }
    return Number(status.stdout.trim()) * 1024;
  }

  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).WorkingSet64`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to sample WorkingSet for pid ${pid}: ${result.stderr.trim()}`);
  }
  return Number(result.stdout.trim());
}

function summarizeBytes(bytes) {
  return `${(bytes / mib).toFixed(2)} MiB`;
}

async function requestJson(baseUrl, route) {
  let response;
  try {
    response = await fetch(new URL(route, baseUrl), {
      headers: { accept: "application/json" },
    });
  } catch (error) {
    throw new Error(`${route} fetch failed: ${error.cause?.message || error.message}`);
  }

  if (!response.ok) {
    throw new Error(`${route} failed with HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function requestText(baseUrl, route) {
  let response;
  try {
    response = await fetch(new URL(route, baseUrl), {
      headers: { accept: "text/html" },
    });
  } catch (error) {
    throw new Error(`${route} fetch failed: ${error.cause?.message || error.message}`);
  }

  if (!response.ok) {
    throw new Error(`${route} failed with HTTP ${response.status}: ${await response.text()}`);
  }

  return response.text();
}

async function waitForReady(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Homepage server exited early with code ${child.exitCode}.`);
    }

    try {
      await requestText(baseUrl, "/api/healthcheck");
      return;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }

  throw new Error(`Homepage server did not become ready: ${lastError?.message}`);
}

async function waitForMeasuredRoutes(baseUrl, child) {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Homepage server exited early with code ${child.exitCode}.`);
    }

    try {
      await runIteration(baseUrl);
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }

  throw new Error(`Homepage measured routes did not become ready: ${lastError?.message}`);
}

function assertPayloads(payloads) {
  if (!payloads.home.includes("__NEXT_DATA__")) {
    throw new Error("Homepage root did not include Next page data.");
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

async function runIteration(baseUrl) {
  const [home, widgets, glances, resourcesCpu, resourcesMemory, resourcesUptime] = await Promise.all([
    requestText(baseUrl, "/"),
    requestJson(baseUrl, "/api/widgets"),
    requestJson(baseUrl, "/api/widgets/glances?index=0&version=4&uptime=1&cputemp=1&disk=1"),
    requestJson(baseUrl, "/api/widgets/resources?type=cpu"),
    requestJson(baseUrl, "/api/widgets/resources?type=memory"),
    requestJson(baseUrl, "/api/widgets/resources?type=uptime"),
  ]);

  assertPayloads({ glances, home, resourcesCpu, resourcesMemory, resourcesUptime, widgets });
}

function startHomepageServer(upstreamDir, configDir, port) {
  const serverPath = path.join(upstreamDir, ".next/standalone/server.js");
  if (!existsSync(serverPath)) {
    throw new Error(`Missing ${serverPath}. Run upstream \`pnpm build\` first.`);
  }

  return spawn(process.execPath, [serverPath], {
    cwd: path.join(upstreamDir, ".next/standalone"),
    env: {
      ...process.env,
      HOMEPAGE_ALLOWED_HOSTS: `127.0.0.1:${port},localhost:${port}`,
      HOMEPAGE_CONFIG_DIR: configDir,
      HOSTNAME: "127.0.0.1",
      LOG_TARGETS: "stdout",
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill();
  await Promise.race([
    new Promise((resolve) => {
      child.once("exit", resolve);
    }),
    sleep(5000).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }),
  ]);
}

async function main() {
  const options = parseArgs();
  if (!Number.isFinite(options.seconds) || options.seconds <= 0) {
    throw new Error(`Invalid seconds: ${options.seconds}`);
  }
  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    throw new Error(`Invalid interval-ms: ${options.intervalMs}`);
  }

  const configDir = await mkdtemp(path.join(os.tmpdir(), "homepage-upstream-soak-"));
  const glancesMock = await startGlancesMock();
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const childLogs = [];
  let child;

  try {
    await writeFixtureConfig(configDir, glancesMock.url);
    child = startHomepageServer(options.upstreamDir, configDir, port);
    child.stdout.on("data", (chunk) => childLogs.push(chunk.toString()));
    child.stderr.on("data", (chunk) => childLogs.push(chunk.toString()));

    await waitForReady(baseUrl, child);
    await waitForMeasuredRoutes(baseUrl, child);

    const startedAt = Date.now();
    const deadline = startedAt + options.seconds * 1000;
    let iterations = 0;
    const warmRss = workingSetBytes(child.pid);
    let peakRss = warmRss;

    while (Date.now() < deadline || iterations === 0) {
      await runIteration(baseUrl);
      iterations += 1;
      const rss = workingSetBytes(child.pid);
      peakRss = Math.max(peakRss, rss);
      if (Date.now() < deadline) {
        await sleep(options.intervalMs);
      }
    }

    const endRss = workingSetBytes(child.pid);
    const rssGrowth = Math.max(0, endRss - warmRss);

    console.log(
      [
        "Homepage upstream soak measurement complete.",
        `duration=${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
        `iterations=${iterations}`,
        `pid=${child.pid}`,
        `warmRss=${summarizeBytes(warmRss)}`,
        `endRss=${summarizeBytes(endRss)}`,
        `peakRss=${summarizeBytes(peakRss)}`,
        `rssGrowth=${summarizeBytes(rssGrowth)}`,
      ].join(" "),
    );
  } catch (error) {
    const recentLogs = childLogs.join("").split(/\r?\n/).slice(-20).join("\n");
    throw new Error(`${error.message}${recentLogs ? `\nRecent upstream logs:\n${recentLogs}` : ""}`);
  } finally {
    if (child) {
      await stopChild(child);
    }
    await glancesMock.close();
    await rm(configDir, { force: true, recursive: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(`Homepage upstream soak measurement failed: ${error.message}`);
  process.exit(1);
}
