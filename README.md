# Daemun

Daemun is a lightweight application dashboard for self-hosted services. It is a
fork of the upstream Homepage project, rebuilt around a compact Hono runtime
instead of the original Next.js server.

The fork keeps the practical parts that make the dashboard useful: YAML
configuration, service and bookmark groups, Docker label discovery, Kubernetes
annotations, proxied widgets, translations, and custom CSS/JavaScript. The
runtime and project identity now belong to Daemun.

<p align="center">
  <a href="https://github.com/Clickin/Daemun/actions/workflows/docker-publish.yml"><img alt="Docker workflow status" src="https://img.shields.io/github/actions/workflow/status/Clickin/Daemun/docker-publish.yml"></a>
  &nbsp;
  <a href="https://github.com/Clickin/Daemun/actions/workflows/test.yml"><img alt="Test workflow status" src="https://img.shields.io/github/actions/workflow/status/Clickin/Daemun/test.yml?label=tests"></a>
  &nbsp;
  <a href="https://github.com/Clickin/Daemun/actions/workflows/docs-publish.yml"><img alt="Docs workflow status" src="https://img.shields.io/github/actions/workflow/status/Clickin/Daemun/docs-publish.yml?label=docs"></a>
</p>

## Runtime Direction

- Hono serves the production HTTP runtime and the existing `/api/**` contracts.
- Vite builds the React client browser bundle and the Node server bundle.
- Upstream Homepage is a JavaScript-based stack; Daemun is a full TypeScript
  stack across app, server, and widget layers.
- `pnpm` owns the app, docs, test, and build workflows.
- Astro Starlight replaces the old Python documentation stack.
- Starlight search uses Pagefind.
- The default Docker image runs the Node/Hono server directly on port `3000`.
- The `*-nginx` Docker tags put nginx in front of Daemun over a Unix socket and
  listen on port `80`.
- Docker images are built around the generated `dist` output plus only the
  native runtime dependencies that cannot be bundled.

## Performance Strategy

Daemun keeps upstream Homepage's configuration and widget contracts, but the
runtime is optimized for a smaller dashboard process and fewer first-load
waterfalls.

- The production server is a compact Hono runtime instead of a Next.js server.
  The node-only image stays the smallest option, while the nginx image trades a
  little memory for faster static document and asset delivery.
- The nginx image serves the baked `index.html`, `/assets/**`, and public files
  directly, with Hono listening behind it on a Unix socket for APIs and dynamic
  config routes. This keeps public byte serving out of the Node event loop.
- nginx uses `sendfile on`, `tcp_nopush on`, and `tcp_nodelay on` for static
  responses. For built assets that are already on disk and usually in the kernel
  page cache, this path is a better fit than having Node read file bytes into
  userland buffers and then write them back to a socket.
- HTML and assets use different cache policies. The baked home document is
  served with `Cache-Control: no-cache` so browsers revalidate it and pick up
  changed modulepreload links; hashed Vite assets remain
  `public, max-age=31536000, immutable`.
- The baked home document is config-aware. At startup and after relevant config
  changes, Daemun adds modulepreload links for the service and information
  widgets that are actually configured, while leaving unused widgets lazy.
- The client graph is deliberately smaller. Recharts was removed from Glances in
  favor of D3 primitives, widget chunks stay lazy by default, and only core
  built-in service widgets that benefit from early execution are promoted into
  the initial graph.
- Data fetching avoids avoidable waterfalls. Resource widgets use one batch API
  call for the enabled metrics, Glances starts independent metric calls in
  parallel, and Docker/Kubernetes built-ins use summary paths where that preserves
  the existing UI contract.
- The static home path does not depend on Next.js ISR or a browser discovering
  stale config. Daemun watches YAML config changes from the server process,
  refreshes the baked home document inside the normal runtime, and keeps serving
  the last good document if a refresh fails.

The measured container and browser results against upstream Homepage are kept in
[BENCHMARK.md](BENCHMARK.md). Re-run the benchmark on your target host before
treating the numbers as portable capacity data.

## Release Versioning

Release versions follow the upstream `gethomepage/homepage` family for the
`major.minor` line, while Daemun keeps fork-only behavior changes in the patch
slot.

- Align the first two semver fields (`major.minor`) with the tracked upstream
  version family.
- Use Daemun patch increments (`patch`) for fork-specific changes and runtime
  replacements that keep compatibility contracts intact.
- If a Daemun change is a true compatibility-breaking change, use a major/minor
  bump following normal semver.

Under this policy, this build is `v1.14.4` (upstream-family `1.14`, Daemun patch
`4`).

This keeps Daemun readable against upstream history while still giving us a
predictable release space for fork differences.

## Compatibility

Daemun intentionally preserves compatibility with inherited deployments where it
is useful:

- Existing YAML files under `/app/config`.
- `HOMEPAGE_ALLOWED_HOSTS` and related deployment environment variables.
- Docker discovery labels using the `homepage.*` prefix.
- Kubernetes discovery annotations using the `gethomepage.dev/*` prefix.
- Existing widget and proxy configuration shapes.

Those names are compatibility contracts, not the fork identity.

## Features

- Service groups and web bookmarks.
- Docker container status, stats, and label-based discovery.
- Kubernetes service discovery through annotations.
- More than 100 inherited service integrations.
- Information widgets for resources, weather, time, date, search, and more.
- Hidden server-side proxying for service API keys.
- Custom themes, custom CSS, custom JavaScript, layouts, and localization.

## Install With Docker

Using Docker Compose:

```yaml
services:
  daemun:
    image: ghcr.io/clickin/daemun:latest
    container_name: daemun
    environment:
      HOMEPAGE_ALLOWED_HOSTS: daemun.example.com:3000
      PUID: 1000
      PGID: 1000
    ports:
      - 3000:3000
    volumes:
      - /path/to/config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped
```

Or with `docker run`:

```bash
docker run --name daemun \
  -e HOMEPAGE_ALLOWED_HOSTS=daemun.example.com:3000 \
  -e PUID=1000 \
  -e PGID=1000 \
  -p 3000:3000 \
  -v /path/to/config:/app/config \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --restart unless-stopped \
  ghcr.io/clickin/daemun:latest
```

The default image serves `/`, static assets, and API requests from the direct
Node/Hono runtime. Use `ghcr.io/clickin/daemun:latest-nginx` if you specifically
want nginx in front of Daemun on port `80`.

Before the first tagged release, branch images are available as
`ghcr.io/clickin/daemun:main` and `ghcr.io/clickin/daemun:main-nginx`.

## Build From Source

```bash
git clone https://github.com/Clickin/Daemun.git
cd Daemun
pnpm install
pnpm build
pnpm start
```

If you are starting from an empty config directory, copy the files from
`src/skeleton/` into your config path first.

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Useful verification commands:

```bash
pnpm run lint
pnpm test
pnpm build
pnpm gate:widgets
pnpm gate:upstream-contracts
pnpm gate:real-world:quick
pnpm gate:release
```

`pnpm gate:upstream-contracts` checks the recorded upstream Homepage baseline
against `tools/release-gate/upstream-contract-map.json`. The map keeps each
upstream page test path next to the Daemun contract files that replace it, so a
future upstream baseline update fails until new tests are mapped deliberately.
`pnpm gate:widgets` blocks only on the supported widget baseline recorded by the
current upstream commit. New widgets added to upstream after that baseline are
tracked as parity backlog, not automatic release blockers. To inspect that
non-blocking drift, run:

```bash
node tools/release-gate/verify-widget-registry.mjs --report-upstream-drift
```

Real-world gates are split by cost. `pnpm gate:release` builds the production
bundle first, then `pnpm gate:real-world:quick` runs a short mock-backed loop
for YAML bootstrap, Glances host metrics, and resource API calls without binding
the Daemun app to a port. `pnpm gate:real-world:soak` uses the same production
bundle and scenarios as a longer manual/nightly leak check. Its default duration
is 10 minutes and can be tuned:

```bash
DAEMUN_REAL_WORLD_SOAK_SECONDS=1800 pnpm gate:real-world:soak
```

Container resource and stress comparison against upstream Homepage is documented
in [BENCHMARK.md](BENCHMARK.md).

## Documentation

The published documentation is the Astro Starlight site in `docs-site/`.
Search is powered by Pagefind through Starlight’s built-in search provider.
The sample image on the docs front page is captured from a built Daemun app,
not drawn as a mockup.

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:assets
```

GitHub Pages deployment is handled by `.github/workflows/docs-publish.yml` and
publishes the built Starlight site to:

```text
https://clickin.github.io/Daemun/
```

## Security Notice

Daemun can proxy requests to services that expose personal or operational data.
It does not provide an authentication layer. If Daemun is reachable from an
untrusted network, run it behind a reverse proxy or VPN that enforces
authentication, TLS, and strict host validation.

## Upstream

Daemun is a fork of `gethomepage/homepage`. The upstream project and community
created the original dashboard, widget catalog, translations, and configuration
contracts that this fork continues to support while changing the runtime stack
and long-term project direction.

## License

Daemun inherits the repository license. See [LICENSE](LICENSE).
