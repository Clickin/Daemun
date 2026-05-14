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
- starts each image separately with `--cpus 1`, `--memory 256m`, and
  `--memory-swap 256m`;
- mounts a copied fixture config from `src/test-utils/fixtures/smoke-config` to
  `/app/config`;
- waits on `/api/healthcheck`;
- records idle cgroup memory, `/proc/1/status` RSS values, and `docker stats`;
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
BENCH_CPUS=1 BENCH_MEMORY=256m BENCH_CONCURRENCY=32 BENCH_DURATION_MS=30000 pnpm bench:containers
BENCH_BUILD_DAEMUN=0 DAEMUN_NODE_IMAGE=ghcr.io/clickin/daemun:latest pnpm bench:containers
BENCH_BUILD_DAEMUN=0 DAEMUN_NGINX_IMAGE=ghcr.io/clickin/daemun:nginx pnpm bench:containers
HOMEPAGE_IMAGE=ghcr.io/gethomepage/homepage:latest pnpm bench:containers
BENCH_SAMPLE_DURING_STRESS=1 pnpm bench:containers
```

## Fairness Rules

Both containers must receive identical CPU and memory limits. Do not compare a
Daemun container with a stricter or looser cgroup than the upstream Homepage
container. The recorded image IDs, image sizes, request mix, limits, RSS, Docker
stats, throughput, and latency percentiles belong together as one benchmark run.

## Current Results

Environment:

- Date: 2026-05-14
- Host: Windows/Rancher Desktop, Docker Server 29.1.3, Linux amd64 engine under
  WSL2
- Daemun node-only image: `daemun:node-bench`,
  `sha256:f2d02cdad455aa07d77cc7d87dd9732923f1a237b78f1f737d112d375b2a279c`
- Daemun nginx image: `daemun:nginx-bench`,
  `sha256:dc7b5bc14a24915677be95b7bc27064b6b670c04e3d7f084eaf4adee6bacf3a6`
- Upstream image: `ghcr.io/gethomepage/homepage:latest`,
  `sha256:d8d784e5090111b6e4c56dfd90e272d2953a2094e87349f647165df0fa6c4401`
- Limits: `--cpus 1 --memory 256m --memory-swap 256m`
- Stress: 30 seconds, concurrency 32, same eight endpoint round-robin mix:
  root, healthcheck, services, bookmarks, widgets, favicon, stylesheet, and
  script asset.

Raw result:
`benchmarks/results/container-benchmark-2026-05-14T12-05-36-772Z.json`.

| Metric | Daemun node | Daemun nginx | Upstream Homepage |
| --- | ---: | ---: | ---: |
| Image size | 75.3 MB | 76.2 MB | 84.2 MB |
| Idle cgroup memory | 54.6 MiB | 70.1 MiB | 90.7 MiB |
| Post-stress cgroup memory | 68.2 MiB | 81.8 MiB | 112.0 MiB |
| Peak cgroup memory | 73.6 MiB | 87.7 MiB | 123.6 MiB |
| Idle Docker memory | 53.57 MiB | 68.88 MiB | 89.65 MiB |
| Post-stress Docker memory | 67.04 MiB | 80.56 MiB | 110.9 MiB |
| Aggregate throughput | 441.90 req/s | 423.27 req/s | 295.63 req/s |
| Aggregate failures | 0 | 0 | 0 |
| Aggregate p50 latency | 64.03 ms | 16.92 ms | 110.96 ms |
| Aggregate p95 latency | 159.58 ms | 253.37 ms | 217.76 ms |

Endpoint p50 latency:

| Endpoint | Daemun node | Daemun nginx | Upstream Homepage |
| --- | ---: | ---: | ---: |
| `/` | 28.06 ms | 2.51 ms | 36.22 ms |
| Static stylesheet | 69.55 ms | 5.02 ms | 115.81 ms |
| Static script | 55.56 ms | 3.90 ms | 122.69 ms |
| `/favicon-32x32.png` | 52.64 ms | 1.70 ms | 89.50 ms |
| `/api/healthcheck` | 28.08 ms | 40.40 ms | 33.74 ms |
| `/api/bookmarks` | 91.35 ms | 144.01 ms | 121.45 ms |
| `/api/widgets` | 91.10 ms | 144.92 ms | 120.76 ms |
| `/api/services` | 155.97 ms | 246.01 ms | 209.75 ms |

Interpretation:

- The node-only image is still the smallest and lowest-memory Daemun runtime.
  It keeps a single Hono process and lets Hono serve the baked home page, public
  files, Vite assets, and APIs.
- The nginx image adds about 0.9 MB to image size and about 15 MiB idle cgroup
  memory compared with node-only, but it removes Node from the hot path for
  `index.html` and static assets. Root and static asset p50 latency dropped to
  low single-digit milliseconds.
- The nginx image keeps the product contract from `.omx/Hono API 서버 구성.md`:
  nginx is the only exposed listener, Node listens on
  `/run/daemun/daemun.sock`, `/api/**` and dynamic PWA/config routes proxy to
  Hono over that Unix socket, and nginx serves the baked
  `dist/server/ssg/index.html` plus static files.
- The Unix socket removes TCP loopback overhead, but it does not remove the
  nginx proxy hop itself. API endpoints are still slower through nginx than
  through direct Hono in this Windows/Rancher Desktop run, so node-only wins the
  aggregate mixed workload while nginx remains much faster for root and static
  assets.
- Both Daemun images remain below upstream Homepage memory in this fixture:
  peak cgroup memory was 73.6 MiB for node-only, 87.7 MiB for nginx, and
  123.6 MiB for upstream.

Raw JSON results are intentionally ignored under `benchmarks/results/` so local
host noise is not mistaken for a portable project result. Re-run the command on
the target host before updating these numbers.
