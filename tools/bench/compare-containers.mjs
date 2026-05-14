#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  cpus: process.env.BENCH_CPUS || "1",
  memory: process.env.BENCH_MEMORY || "256m",
  durationMs: Number(process.env.BENCH_DURATION_MS || 30_000),
  warmupMs: Number(process.env.BENCH_WARMUP_MS || 5_000),
  concurrency: Number(process.env.BENCH_CONCURRENCY || 32),
  sampleDuringStress: process.env.BENCH_SAMPLE_DURING_STRESS === "1",
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

  const args = [
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--cpus",
    config.cpus,
    "--memory",
    config.memory,
    "--memory-swap",
    config.memory,
  ];

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
      max: latencies.length ? Number(Math.max(...latencies).toFixed(2)) : null,
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
            max: value.latencies.length ? Number(Math.max(...value.latencies).toFixed(2)) : null,
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
