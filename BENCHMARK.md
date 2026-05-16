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

- Date: 2026-05-16
- Host: Windows/Rancher Desktop, Docker Client 29.1.4-rd, Docker Server
  29.1.3, Linux amd64 engine under WSL2
- Daemun node-only image: `daemun:node-bench`,
  `sha256:833896c6eaea962054d1c8f1fc93c06811ed615cdbcda968ca3d8acf2b8266a1`
- Daemun nginx image: `daemun:nginx-bench`,
  `sha256:d6b0aaba7598cb8d104d20fc1499077acd3bbde8ed229772366b978b961e9fcc`
- Upstream image: `ghcr.io/gethomepage/homepage:latest`,
  `sha256:d8d784e5090111b6e4c56dfd90e272d2953a2094e87349f647165df0fa6c4401`
- Limits: no CPU limit, `--memory 512m --memory-swap 512m`
- Stress: 30 seconds, concurrency 32, same eight endpoint round-robin mix:
  root, healthcheck, services, bookmarks, widgets, favicon, stylesheet, and
  script asset.

Raw result:
`benchmarks/results/container-benchmark-2026-05-16T03-19-53-579Z.json`.

| Metric                    |  Daemun node | Daemun nginx | Upstream Homepage |
| ------------------------- | -----------: | -----------: | ----------------: |
| Image size                |      67.9 MB |      72.6 MB |           84.2 MB |
| Idle cgroup memory        |     64.0 MiB |     80.3 MiB |         197.0 MiB |
| Post-stress cgroup memory |     75.4 MiB |     86.3 MiB |         225.7 MiB |
| Peak cgroup memory        |     79.9 MiB |     91.2 MiB |         238.6 MiB |
| Idle Docker memory        |    63.05 MiB |    79.03 MiB |         101.7 MiB |
| Post-stress Docker memory |       74 MiB |    84.64 MiB |         129.2 MiB |
| Aggregate throughput      | 451.03 req/s | 477.13 req/s |      322.40 req/s |
| Aggregate failures        |            0 |            0 |                 0 |
| Aggregate p50 latency     |     61.55 ms |     11.08 ms |         103.24 ms |
| Aggregate p95 latency     |    157.83 ms |    224.29 ms |         197.34 ms |

Browser cold-load timing:

The harness now records same-browser `/` load timing in the raw JSON under
`results[].browserTimings`. Older raw results do not include this section.
TTLB is read from the navigation entry's `responseEnd`; FCP is read from the
browser's `first-contentful-paint` entry. Cache is disabled and cleared between
iterations so the nginx image's static-file path is measured on the same terms
as direct Hono and upstream Homepage.

| Browser metric for `/` | Daemun node | Daemun nginx | Upstream Homepage |
| ---------------------- | ----------: | -----------: | ----------------: |
| TTLB avg               |    56.37 ms |      5.59 ms |          63.07 ms |
| TTLB p50               |    51.90 ms |      5.10 ms |          62.90 ms |
| FCP avg                |    93.71 ms |     37.71 ms |         128.57 ms |
| FCP p50                |   100.00 ms |     32.00 ms |         128.00 ms |
| DOMContentLoaded avg   |    99.83 ms |     37.21 ms |         166.21 ms |
| Load avg               |   105.31 ms |     37.46 ms |         166.54 ms |

Focused `/` stress result:

Raw result:
`benchmarks/results/container-benchmark-2026-05-16T03-23-12-049Z.json`.

Same limits and duration as the mixed benchmark, but with `BENCH_ENDPOINTS=/`.

| `/` only metric           |   Daemun node |  Daemun nginx | Upstream Homepage |
| ------------------------- | ------------: | ------------: | ----------------: |
| Throughput                | 4144.30 req/s | 4319.40 req/s |     1322.17 req/s |
| Failures                  |             0 |             0 |                 0 |
| p50 latency               |       7.36 ms |       7.03 ms |          20.31 ms |
| p95 latency               |      11.74 ms |      11.40 ms |          41.60 ms |
| p99 latency               |      14.55 ms |      14.33 ms |          50.76 ms |
| Post-stress cgroup memory |      72.4 MiB |      83.4 MiB |         109.2 MiB |

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
| `/`                  |    24.52 ms |      2.31 ms |          33.67 ms |
| Static stylesheet    |    68.10 ms |      4.60 ms |         106.23 ms |
| Static script        |    51.83 ms |      2.08 ms |         113.39 ms |
| `/favicon-32x32.png` |    52.09 ms |      1.48 ms |          82.90 ms |
| `/api/healthcheck`   |    27.27 ms |     35.23 ms |          31.15 ms |
| `/api/bookmarks`     |    91.36 ms |    129.39 ms |         111.45 ms |
| `/api/widgets`       |    90.01 ms |    130.22 ms |         110.82 ms |
| `/api/services`      |   154.42 ms |    220.50 ms |         191.73 ms |

Interpretation:

- The node-only image is still the smallest and lowest-memory Daemun runtime.
  It keeps a single Hono process and lets Hono serve the baked home page, public
  files, Vite assets, and APIs.
- The nginx image adds about 4.7 MB to image size and about 16.0 MiB idle Docker
  memory compared with node-only, but it removes Node from the hot path for
  `index.html` and static assets. Root and static asset p50 latency dropped to
  low single-digit milliseconds.
- Browser timing shows the same effect at the page-load level: in this run
  nginx reduced `/` TTLB average to 5.59 ms and FCP average to 37.71 ms under
  the same headless Chrome executable and cache-disabled cold-load settings. The
  current client chunking and Inertia removal also lowered node-only and nginx
  FCP compared with the previous recorded benchmark.
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
  post-stress Docker memory was 74 MiB for node-only, 84.64 MiB for nginx, and
  129.2 MiB for upstream. cgroup memory can include page cache, so Docker
  `MemUsage` and cgroup current/peak should be read together rather than mixed
  across separate runs.

Raw JSON results are intentionally ignored under `benchmarks/results/` so local
host noise is not mistaken for a portable project result. Re-run the command on
the target host before updating these numbers.
