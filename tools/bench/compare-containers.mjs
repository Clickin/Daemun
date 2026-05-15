#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const rootDir = process.cwd();
const resultDir = path.join(rootDir, "benchmarks", "results");
const tmpRoot = mkdtempSync(path.join(tmpdir(), "daemun-bench-"));
const configuredEndpoints = process.env.BENCH_ENDPOINTS
  ? process.env.BENCH_ENDPOINTS.split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  : null;

function defaultEndpoints() {
  return ["/", "/api/healthcheck", "/api/services", "/api/bookmarks", "/api/widgets", "/favicon-32x32.png"];
}

const config = {
  daemunNodeImage: process.env.DAEMUN_NODE_IMAGE || process.env.DAEMUN_IMAGE || "daemun:node-bench",
  daemunNginxImage: process.env.DAEMUN_NGINX_IMAGE || "daemun:nginx-bench",
  homepageImage: process.env.HOMEPAGE_IMAGE || "ghcr.io/gethomepage/homepage:latest",
  buildDaemunNode: process.env.BENCH_BUILD_DAEMUN_NODE !== "0" && process.env.BENCH_BUILD_DAEMUN !== "0",
  buildDaemunNginx: process.env.BENCH_BUILD_DAEMUN_NGINX !== "0" && process.env.BENCH_BUILD_DAEMUN !== "0",
  pullHomepage: process.env.BENCH_PULL_HOMEPAGE !== "0",
  cpus: process.env.BENCH_CPUS?.trim() || null,
  memory: process.env.BENCH_MEMORY || "512m",
  durationMs: Number(process.env.BENCH_DURATION_MS || 30_000),
  warmupMs: Number(process.env.BENCH_WARMUP_MS || 5_000),
  concurrency: Number(process.env.BENCH_CONCURRENCY || 32),
  sampleDuringStress: process.env.BENCH_SAMPLE_DURING_STRESS === "1",
  browserTimings: process.env.BENCH_BROWSER_TIMINGS !== "0",
  browserBin: process.env.BENCH_BROWSER_BIN || process.env.CHROME_PATH || process.env.CHROMIUM_PATH || process.env.MSEDGE_PATH,
  browserIterations: Number(process.env.BENCH_BROWSER_ITERATIONS || 7),
  browserWarmupIterations: Number(process.env.BENCH_BROWSER_WARMUP_ITERATIONS || 1),
  endpoints: configuredEndpoints,
  fixtureConfigDir: path.resolve(process.env.BENCH_CONFIG_DIR || "src/test-utils/fixtures/smoke-config"),
};

const targets = [
  {
    allowAllHosts: true,
    containerPort: 3000,
    dockerfile: "Dockerfile",
    image: config.daemunNodeImage,
    label: "daemun-node",
  },
  {
    allowAllHosts: false,
    containerPort: 80,
    dockerfile: "Dockerfile.nginx",
    image: config.daemunNginxImage,
    label: "daemun-nginx",
  },
  { allowAllHosts: true, containerPort: 3000, image: config.homepageImage, label: "homepage" },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status}${stderr ? `\n${stderr}` : ""}${
        stdout ? `\n${stdout}` : ""
      }`,
    );
  }

  return result.stdout ?? "";
}

function docker(args, options) {
  return run("docker", args, options);
}

function prepareConfig(label) {
  if (!existsSync(config.fixtureConfigDir)) {
    throw new Error(`Benchmark fixture config directory does not exist: ${config.fixtureConfigDir}`);
  }

  const target = path.join(tmpRoot, label, "config");
  mkdirSync(target, { recursive: true });
  cpSync(config.fixtureConfigDir, target, { recursive: true });
  return target;
}

function inspectImage(image) {
  const raw = docker(["image", "inspect", image, "--format", "{{json .}}"], { capture: true }).trim();
  const data = JSON.parse(raw);
  return {
    id: data.Id,
    repoDigests: data.RepoDigests ?? [],
    sizeBytes: data.Size,
  };
}

function parsePort(output) {
  const match = output.trim().match(/(?:0\.0\.0\.0|127\.0\.0\.1|\[::\]|::):(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse mapped port from: ${output}`);
  }
  return Number(match[1]);
}

function startContainer(target) {
  const name = `daemun-bench-${target.label}-${Date.now()}`;
  const configDir = prepareConfig(target.label);

  const args = ["run", "--detach", "--rm", "--name", name, "--memory", config.memory, "--memory-swap", config.memory];

  if (config.cpus) {
    args.push("--cpus", config.cpus);
  }

  if (target.allowAllHosts) {
    args.push("--env", "HOMEPAGE_ALLOWED_HOSTS=*");
  }

  args.push("--volume", `${configDir}:/app/config`, "--publish", `127.0.0.1::${target.containerPort}`, target.image);

  docker(args);

  const port = parsePort(docker(["port", name, `${target.containerPort}/tcp`], { capture: true }));
  return { name, port, configDir };
}

function stopContainer(container) {
  if (!container?.name) return;
  spawnSync("docker", ["stop", container.name], { cwd: rootDir, stdio: "ignore" });
}

function httpGet(url, timeoutMs = 10_000) {
  const start = performance.now();
  return new Promise((resolve) => {
    const req = request(url, { method: "GET", timeout: timeoutMs }, (res) => {
      res.resume();
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          ms: performance.now() - start,
        });
      });
    });

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => resolve({ ok: false, error: error.message, ms: performance.now() - start }));
    req.end();
  });
}

async function httpText(url, timeoutMs = 10_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function waitForHealthy(baseUrl) {
  const deadline = Date.now() + 90_000;
  let last;
  while (Date.now() < deadline) {
    last = await httpGet(`${baseUrl}/api/healthcheck`, 2_000);
    if (last.ok && last.status === 200) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Container did not become healthy: ${JSON.stringify(last)}`);
}

function extractStaticAssetEndpoints(html) {
  const endpoints = [];
  const matches = html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g);

  for (const match of matches) {
    const endpoint = match[1];
    if (!endpoint.startsWith("/assets/") && !endpoint.startsWith("/_next/static/")) continue;
    if (!/\.(?:css|js)(?:\?|$)/.test(endpoint)) continue;
    if (!endpoints.includes(endpoint)) endpoints.push(endpoint);
    if (endpoints.length >= 2) break;
  }

  return endpoints;
}

async function resolveTargetEndpoints(baseUrl) {
  if (configuredEndpoints) return configuredEndpoints;
  const homeHtml = await httpText(`${baseUrl}/`);
  return [...defaultEndpoints(), ...extractStaticAssetEndpoints(homeHtml)];
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

function maxValue(values) {
  if (values.length === 0) return null;
  let max = values[0];
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > max) max = values[index];
  }
  return Number(max.toFixed(2));
}

function average(values) {
  const measured = values.filter((value) => Number.isFinite(value));
  if (measured.length === 0) return null;
  return Number((measured.reduce((sum, value) => sum + value, 0) / measured.length).toFixed(2));
}

function summarizeMetric(samples, key) {
  const values = samples.map((sample) => sample[key]).filter((value) => Number.isFinite(value));
  return {
    avg: average(values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    min: values.length ? Number(Math.min(...values).toFixed(2)) : null,
    max: values.length ? Number(Math.max(...values).toFixed(2)) : null,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function removeDirectoryWithRetry(directory) {
  let lastError;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await delay(100 * (attempt + 1));
    }
  }

  throw lastError;
}

function findCommandOnPath(command) {
  const lookup = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookup, [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (result.status !== 0) return null;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function browserCandidates() {
  const candidates = [];
  if (config.browserBin) candidates.push(config.browserBin);

  if (process.platform === "win32") {
    for (const base of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (!base) continue;
      candidates.push(
        path.join(base, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(base, "Chromium", "Application", "chrome.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      findCommandOnPath("google-chrome-stable"),
      findCommandOnPath("google-chrome"),
      findCommandOnPath("chromium"),
      findCommandOnPath("chromium-browser"),
      findCommandOnPath("microsoft-edge"),
    );
  }

  return candidates.filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
}

function findBrowserExecutable() {
  for (const candidate of browserCandidates()) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

async function waitForDevToolsPort(userDataDir) {
  const portFile = path.join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      if (existsSync(portFile)) {
        const [port, token] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
        if (port && token) return { port: Number(port), token };
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  throw new Error(`Browser did not expose DevToolsActivePort${lastError ? `: ${lastError.message}` : ""}`);
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function createCdpConnection(wsUrl) {
  let id = 0;
  const pending = new Map();
  const socket = new WebSocket(wsUrl);

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error(`Could not connect to ${wsUrl}`)), { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const requestState = pending.get(message.id);
    if (!requestState) return;
    pending.delete(message.id);
    if (message.error) {
      requestState.reject(new Error(`${requestState.method} failed: ${message.error.message}`));
    } else {
      requestState.resolve(message.result ?? {});
    }
  });

  return {
    async ready() {
      await opened;
    },
    send(method, params = {}, sessionId = undefined) {
      id += 1;
      const message = { id, method, params };
      if (sessionId) message.sessionId = sessionId;
      socket.send(JSON.stringify(message));
      return new Promise((resolve, reject) => {
        pending.set(id, { method, resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

async function launchBrowser() {
  const executable = findBrowserExecutable();
  if (!executable) {
    return { skipped: true, reason: "No Chrome, Edge, or Chromium executable found. Set BENCH_BROWSER_BIN to enable." };
  }

  const userDataDir = mkdtempSync(path.join(tmpdir(), "daemun-bench-browser-"));
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-sync",
      "--hide-scrollbars",
      "--no-default-browser-check",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const { port } = await waitForDevToolsPort(userDataDir);
    const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
    return {
      executable,
      port,
      userDataDir,
      version,
      child,
      async close() {
        if (child.exitCode === null && child.signalCode === null) child.kill();
        await waitForProcessExit(child);
        await removeDirectoryWithRetry(userDataDir);
      },
    };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await waitForProcessExit(child);
    await removeDirectoryWithRetry(userDataDir);
    throw error;
  }
}

async function waitForPageLoad(cdp, sessionId, timeoutMs = 15_000) {
  const startedAt = Date.now();
  let completedNavigation;

  while (Date.now() - startedAt < timeoutMs) {
    const { result } = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const navigation = performance.getEntriesByType("navigation")[0];
          const fcp = performance.getEntriesByName("first-contentful-paint")[0];
          return {
            readyState: document.readyState,
            ttlbMs: navigation ? navigation.responseEnd - navigation.startTime : null,
            fcpMs: fcp ? fcp.startTime : null,
            domContentLoadedMs: navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : null,
            loadMs: navigation ? navigation.loadEventEnd - navigation.startTime : null,
            transferSize: navigation ? navigation.transferSize : null
          };
        })()`,
        returnByValue: true,
      },
      sessionId,
    );

    const value = result.value;
    if (value?.readyState === "complete" && Number.isFinite(value.ttlbMs) && Number.isFinite(value.loadMs)) {
      completedNavigation = {
        domContentLoadedMs: Number(value.domContentLoadedMs.toFixed(2)),
        fcpMs: Number.isFinite(value.fcpMs) ? Number(value.fcpMs.toFixed(2)) : null,
        loadMs: Number(value.loadMs.toFixed(2)),
        transferSize: value.transferSize,
        ttlbMs: Number(value.ttlbMs.toFixed(2)),
      };

      if (completedNavigation.fcpMs !== null || Date.now() - startedAt > 5_000) return completedNavigation;
    }

    await delay(50);
  }

  if (completedNavigation) return completedNavigation;
  throw new Error("Timed out waiting for page load metrics");
}

async function measureBrowserTimings(baseUrl) {
  if (!config.browserTimings) return { skipped: true, reason: "Disabled by BENCH_BROWSER_TIMINGS=0" };
  const browser = await launchBrowser();
  if (browser.skipped) return browser;

  const cdp = createCdpConnection(browser.version.webSocketDebuggerUrl);
  const samples = [];

  try {
    await cdp.ready();
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { flatten: true, targetId });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);

    const totalIterations = config.browserWarmupIterations + config.browserIterations;
    for (let index = 0; index < totalIterations; index += 1) {
      await cdp.send("Network.clearBrowserCache", {}, sessionId);
      await cdp.send("Page.navigate", { url: `${baseUrl}/?bench=${Date.now()}-${index}` }, sessionId);
      const sample = await waitForPageLoad(cdp, sessionId);
      if (index >= config.browserWarmupIterations) samples.push(sample);
    }

    await cdp.send("Target.closeTarget", { targetId });

    return {
      browser: {
        executable: browser.executable,
        product: browser.version.Browser,
        protocolVersion: browser.version["Protocol-Version"],
        userAgent: browser.version["User-Agent"],
      },
      iterations: config.browserIterations,
      warmupIterations: config.browserWarmupIterations,
      url: "/",
      metrics: {
        ttlbMs: summarizeMetric(samples, "ttlbMs"),
        fcpMs: summarizeMetric(samples, "fcpMs"),
        domContentLoadedMs: summarizeMetric(samples, "domContentLoadedMs"),
        loadMs: summarizeMetric(samples, "loadMs"),
      },
      samples,
    };
  } finally {
    cdp.close();
    await browser.close();
  }
}

async function load(baseUrl, durationMs, concurrency, endpoints) {
  const deadline = Date.now() + durationMs;
  const latencies = [];
  const byEndpoint = new Map();
  const statuses = new Map();
  let completed = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (Date.now() < deadline) {
      const endpoint = endpoints[cursor % endpoints.length];
      cursor += 1;
      const result = await httpGet(`${baseUrl}${endpoint}`);
      latencies.push(result.ms);
      const endpointStats = byEndpoint.get(endpoint) ?? { completed: 0, failed: 0, latencies: [], statuses: new Map() };
      endpointStats.completed += 1;
      endpointStats.latencies.push(result.ms);
      completed += 1;
      if (!result.ok) {
        failed += 1;
        endpointStats.failed += 1;
      }
      const key = result.status ?? result.error ?? "unknown";
      statuses.set(key, (statuses.get(key) ?? 0) + 1);
      endpointStats.statuses.set(key, (endpointStats.statuses.get(key) ?? 0) + 1);
      byEndpoint.set(endpoint, endpointStats);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    completed,
    failed,
    requestsPerSecond: Number((completed / (durationMs / 1000)).toFixed(2)),
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: maxValue(latencies),
    },
    statuses: Object.fromEntries([...statuses.entries()].map(([key, value]) => [String(key), value])),
    byEndpoint: Object.fromEntries(
      [...byEndpoint.entries()].map(([endpoint, value]) => [
        endpoint,
        {
          completed: value.completed,
          failed: value.failed,
          requestsPerSecond: Number((value.completed / (durationMs / 1000)).toFixed(2)),
          latencyMs: {
            p50: percentile(value.latencies, 50),
            p95: percentile(value.latencies, 95),
            p99: percentile(value.latencies, 99),
            max: maxValue(value.latencies),
          },
          statuses: Object.fromEntries([...value.statuses.entries()].map(([key, count]) => [String(key), count])),
        },
      ]),
    ),
  };
}

function readProcessStatus(containerName) {
  const raw = docker(["exec", containerName, "awk", "/VmRSS|VmHWM|VmSize/ {print}", "/proc/1/status"], {
    capture: true,
  });
  const fields = {};
  for (const line of raw.trim().split(/\r?\n/)) {
    const match = line.match(/^(VmRSS|VmHWM|VmSize):\s+(\d+)\s+kB$/);
    if (match) fields[match[1]] = Number(match[2]);
  }
  return fields;
}

function readCgroupMemory(containerName) {
  const script = [
    "set -eu",
    "if [ -f /sys/fs/cgroup/memory.current ]; then echo current=$(cat /sys/fs/cgroup/memory.current); fi",
    "if [ -f /sys/fs/cgroup/memory.peak ]; then echo peak=$(cat /sys/fs/cgroup/memory.peak); fi",
    "if [ -f /sys/fs/cgroup/memory/memory.usage_in_bytes ]; then echo current=$(cat /sys/fs/cgroup/memory/memory.usage_in_bytes); fi",
    "if [ -f /sys/fs/cgroup/memory/memory.max_usage_in_bytes ]; then echo peak=$(cat /sys/fs/cgroup/memory/memory.max_usage_in_bytes); fi",
  ].join("; ");
  const raw = docker(["exec", containerName, "sh", "-c", script], { capture: true });
  const fields = {};

  for (const line of raw.trim().split(/\r?\n/)) {
    const match = line.match(/^(current|peak)=(\d+)$/);
    if (match) fields[match[1]] = Number(match[2]);
  }

  return fields;
}

function sampleDockerStats(containerName) {
  const raw = docker(["stats", "--no-stream", "--format", "{{json .}}", containerName], { capture: true }).trim();
  return raw ? JSON.parse(raw) : null;
}

async function measureTarget(target) {
  const image = inspectImage(target.image);
  const container = startContainer(target);
  const baseUrl = `http://127.0.0.1:${container.port}`;

  try {
    await waitForHealthy(baseUrl);
    const endpoints = await resolveTargetEndpoints(baseUrl);
    const idle = {
      cgroup: readCgroupMemory(container.name),
      process: readProcessStatus(container.name),
      docker: sampleDockerStats(container.name),
    };
    const browserTimings = await measureBrowserTimings(baseUrl);

    await load(baseUrl, config.warmupMs, Math.min(8, config.concurrency), endpoints);

    const samples = [];
    const timer = config.sampleDuringStress
      ? setInterval(() => {
          try {
            samples.push(sampleDockerStats(container.name));
          } catch {
            // Keep the load test running; the final sample still covers the run.
          }
        }, 1_000)
      : null;

    const stress = await load(baseUrl, config.durationMs, config.concurrency, endpoints);
    if (timer) clearInterval(timer);

    const after = {
      cgroup: readCgroupMemory(container.name),
      process: readProcessStatus(container.name),
      docker: sampleDockerStats(container.name),
    };

    return {
      label: target.label,
      image,
      baseUrl,
      endpoints,
      idle,
      browserTimings,
      stress,
      after,
      samples,
    };
  } finally {
    stopContainer(container);
  }
}

async function main() {
  mkdirSync(resultDir, { recursive: true });

  if (config.buildDaemunNode) {
    docker(["build", "--file", "Dockerfile", "--tag", config.daemunNodeImage, "."]);
  }
  if (config.buildDaemunNginx) {
    docker(["build", "--file", "Dockerfile.nginx", "--tag", config.daemunNginxImage, "."]);
  }
  if (config.pullHomepage) {
    docker(["pull", config.homepageImage]);
  }

  const results = [];
  for (const target of targets) {
    results.push(await measureTarget(target));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    host: docker(["version", "--format", "{{json .}}"], { capture: true }).trim(),
    config,
    results,
  };

  const outputFile = path.join(resultDir, `container-benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${outputFile}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
