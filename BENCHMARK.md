# Benchmarking

This repository compares Daemun against upstream `gethomepage/homepage` with the
same container limits, same fixture configuration, and same request mix.

## Container Benchmark

Run:

```bash
pnpm bench:containers
```

By default the harness:

- builds `daemun:node-bench` from `Dockerfile`;
- builds `daemun:nginx-bench` from `Dockerfile.nginx`;
- pulls `ghcr.io/gethomepage/homepage:latest`;
- starts each image separately with no CPU limit, `--memory 512m`, and
  `--memory-swap 512m`;
- mounts a copied fixture config from `src/test-utils/fixtures/smoke-config` to
  `/app/config`;
- waits on `/api/healthcheck`;
- records idle cgroup memory, `/proc/1/status` RSS values, and `docker stats`;
- measures browser cold-load timing for `/` with the same local Chrome, Edge, or
  Chromium executable and settings for every target, recording TTLB
  (`navigation.responseEnd`) and FCP (`first-contentful-paint`) over 7 measured
  loads after 1 warmup load;
- runs a 30 second HTTP stress pass at concurrency 32 against:
  `/`, `/api/healthcheck`, `/api/services`, `/api/bookmarks`, `/api/widgets`,
  `/favicon-32x32.png`, and two static asset URLs discovered from each target's
  rendered HTML;
- reports aggregate and endpoint-level throughput, status counts, and latency
  percentiles;
- records post-stress RSS and `docker stats`; during-stress `docker stats`
  sampling is off by default because synchronous Docker CLI calls distort
  client-side latency on Windows;
- writes raw JSON under `benchmarks/results/`.

Useful overrides:

```bash
BENCH_MEMORY=512m BENCH_CONCURRENCY=32 BENCH_DURATION_MS=30000 pnpm bench:containers
BENCH_CPUS=1 BENCH_MEMORY=256m pnpm bench:containers
BENCH_BUILD_DAEMUN=0 DAEMUN_NODE_IMAGE=ghcr.io/clickin/daemun:latest pnpm bench:containers
BENCH_BUILD_DAEMUN=0 DAEMUN_NGINX_IMAGE=ghcr.io/clickin/daemun:latest-nginx pnpm bench:containers
HOMEPAGE_IMAGE=ghcr.io/gethomepage/homepage:latest pnpm bench:containers
BENCH_SAMPLE_DURING_STRESS=1 pnpm bench:containers
BENCH_ENDPOINTS=/ pnpm bench:containers
BENCH_BROWSER_BIN=/path/to/chrome BENCH_BROWSER_ITERATIONS=11 pnpm bench:containers
BENCH_BROWSER_TIMINGS=0 pnpm bench:containers
```

## Fairness Rules

Both containers must receive identical cgroup settings. The default intentionally
uses no Docker CPU cap and a fixed 512 MB memory cap because homelab deployments
commonly set memory limits while leaving CPU scheduling to the host. If you set
`BENCH_CPUS`, set it for every target in the same run and record it with the
result. The recorded image IDs, image sizes, request mix, limits, RSS, Docker
stats, throughput, and latency percentiles belong together as one benchmark run.

## Focused Workloads

The default benchmark uses a mixed eight-endpoint request pattern because that is
closer to a dashboard session: root HTML, healthcheck, YAML-backed API routes,
favicon, stylesheet, and script. To isolate a hot path, set `BENCH_ENDPOINTS` to
a comma-separated endpoint list.

For example, `BENCH_ENDPOINTS=/ pnpm bench:containers` measures only the baked
home route. This is the strongest stress test for the default nginx image's
static `index.html` path, while the default mixed run remains the better
product-level comparison.

## Current Results

Environment:

- Date: 2026-05-15
- Host: Windows/Rancher Desktop, Docker Client 29.1.4-rd, Docker Server
  29.1.3, Linux amd64 engine under WSL2
- Daemun node-only image: `daemun:node-bench`,
  `sha256:f2d02cdad455aa07d77cc7d87dd9732923f1a237b78f1f737d112d375b2a279c`
- Daemun nginx image: `daemun:nginx-bench`,
  `sha256:dc7b5bc14a24915677be95b7bc27064b6b670c04e3d7f084eaf4adee6bacf3a6`
- Upstream image: `ghcr.io/gethomepage/homepage:latest`,
  `sha256:d8d784e5090111b6e4c56dfd90e272d2953a2094e87349f647165df0fa6c4401`
- Limits: no CPU limit, `--memory 512m --memory-swap 512m`
- Stress: 30 seconds, concurrency 32, same eight endpoint round-robin mix:
  root, healthcheck, services, bookmarks, widgets, favicon, stylesheet, and
  script asset.

Raw result:
`benchmarks/results/container-benchmark-2026-05-15T09-49-59-102Z.json`.

| Metric                    |  Daemun node | Daemun nginx | Upstream Homepage |
| ------------------------- | -----------: | -----------: | ----------------: |
| Image size                |      75.3 MB |      76.2 MB |           84.2 MB |
| Idle cgroup memory        |    131.8 MiB |     79.2 MiB |         196.9 MiB |
| Post-stress cgroup memory |    151.1 MiB |     86.0 MiB |         229.2 MiB |
| Peak cgroup memory        |    155.2 MiB |     91.0 MiB |         242.6 MiB |
| Idle Docker memory        |    58.92 MiB |    72.67 MiB |         101.8 MiB |
| Post-stress Docker memory |    71.75 MiB |     79.3 MiB |         132.3 MiB |
| Aggregate throughput      | 484.40 req/s | 509.57 req/s |      362.57 req/s |
| Aggregate failures        |            0 |            0 |                 0 |
| Aggregate p50 latency     |     57.03 ms |     13.84 ms |          93.37 ms |
| Aggregate p95 latency     |    144.15 ms |    210.03 ms |         175.76 ms |

Browser cold-load timing:

The harness now records same-browser `/` load timing in the raw JSON under
`results[].browserTimings`. Older raw results do not include this section.
TTLB is read from the navigation entry's `responseEnd`; FCP is read from the
browser's `first-contentful-paint` entry. Cache is disabled and cleared between
iterations so the nginx image's static-file path is measured on the same terms
as direct Hono and upstream Homepage.

| Browser metric for `/` | Daemun node | Daemun nginx | Upstream Homepage |
| ---------------------- | ----------: | -----------: | ----------------: |
| TTLB avg               |    59.76 ms |     12.49 ms |          60.16 ms |
| TTLB p50               |    45.60 ms |     11.10 ms |          62.70 ms |
| FCP avg                |   345.14 ms |    291.43 ms |         277.14 ms |
| FCP p50                |   328.00 ms |    284.00 ms |         272.00 ms |
| DOMContentLoaded avg   |   323.59 ms |    272.99 ms |         284.89 ms |
| Load avg               |   331.81 ms |    279.67 ms |         286.71 ms |

Focused `/` stress result:

Raw result:
`benchmarks/results/container-benchmark-2026-05-15T09-52-25-922Z.json`.

Same limits and duration as the mixed benchmark, but with `BENCH_ENDPOINTS=/`.

| `/` only metric           |   Daemun node |  Daemun nginx | Upstream Homepage |
| ------------------------- | ------------: | ------------: | ----------------: |
| Throughput                | 6482.50 req/s | 6183.27 req/s |     1414.93 req/s |
| Failures                  |             0 |             0 |                 0 |
| p50 latency               |       3.28 ms |       3.56 ms |          19.40 ms |
| p95 latency               |      12.08 ms |      12.88 ms |          39.18 ms |
| p99 latency               |      17.30 ms |      18.34 ms |          44.56 ms |
| Post-stress cgroup memory |      64.4 MiB |      77.8 MiB |         109.1 MiB |

This focused run shows that both Daemun images are much faster than upstream
Homepage on the baked root route. It does not show a meaningful nginx-vs-node
RPS gap because the node-only image also serves a baked SSG `index.html`, and on
this Windows/Rancher Desktop host the tiny-response client loop appears to
saturate before nginx can widen throughput. nginx's advantage is clearer in
browser TTLB and in static asset latency, where Node is completely removed from
the request path.

Endpoint p50 latency:

| Endpoint             | Daemun node | Daemun nginx | Upstream Homepage |
| -------------------- | ----------: | -----------: | ----------------: |
| `/`                  |    27.09 ms |      1.75 ms |          30.08 ms |
| Static stylesheet    |    61.11 ms |      4.09 ms |          95.64 ms |
| Static script        |    49.20 ms |      3.00 ms |         102.55 ms |
| `/favicon-32x32.png` |    47.44 ms |      1.21 ms |          75.31 ms |
| `/api/healthcheck`   |    25.75 ms |     33.50 ms |          27.55 ms |
| `/api/bookmarks`     |    82.47 ms |    121.65 ms |         100.90 ms |
| `/api/widgets`       |    82.80 ms |    122.48 ms |         101.12 ms |
| `/api/services`      |   141.07 ms |    206.78 ms |         172.65 ms |

Interpretation:

- The node-only image is still the smallest and lowest-memory Daemun runtime.
  It keeps a single Hono process and lets Hono serve the baked home page, public
  files, Vite assets, and APIs.
- The nginx image adds about 0.9 MB to image size and about 13.8 MiB idle Docker
  memory compared with node-only, but it removes Node from the hot path for
  `index.html` and static assets. Root and static asset p50 latency dropped to
  low single-digit milliseconds.
- Browser timing shows the same effect at the page-load level: in this run
  nginx reduced `/` TTLB average to 12.49 ms and FCP average to 291.43 ms under
  the same headless Chrome executable and cache-disabled cold-load settings.
- The nginx image exposes only nginx to the host. The Hono server listens on
  `/run/daemun/daemun.sock`; `/api/**` and dynamic PWA/config routes proxy to
  Hono over that Unix socket, while nginx serves the baked
  `dist/server/ssg/index.html` and static files directly.
- The Unix socket removes TCP loopback overhead, but it does not remove the
  nginx proxy hop itself. API endpoints are still slower through nginx than
  through direct Hono in this Windows/Rancher Desktop run. Aggregate throughput
  depends on the request mix; with no CPU cap and 512 MB memory, the
  eight-endpoint benchmark favors nginx because `/`, favicon, CSS, and JS are
  served without entering Node.
- Both Daemun images remain below upstream Homepage memory in this fixture:
  post-stress Docker memory was 71.75 MiB for node-only, 79.3 MiB for nginx,
  and 132.3 MiB for upstream. cgroup memory can include page cache, so Docker
  `MemUsage` and cgroup current/peak should be read together rather than mixed
  across separate runs.

Raw JSON results are intentionally ignored under `benchmarks/results/` so local
host noise is not mistaken for a portable project result. Re-run the command on
the target host before updating these numbers.
