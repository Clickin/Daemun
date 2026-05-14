<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/banner_light@2x.png">
    <img src="images/banner_dark@2x.png" width="65%">
  </picture>
</p>

<p align="center">
  Daemun is a lightweight Hono/Vite application dashboard with proxied service integrations, YAML configuration, Docker label discovery, and translations into multiple languages.
</p>

<p align="center">
  <img src="images/1.png?v=2" />
</p>

<p align="center">
  <a href="https://github.com/Clickin/Daemun/actions/workflows/docker-publish.yml"><img alt="Docker workflow status" src="https://img.shields.io/github/actions/workflow/status/Clickin/Daemun/docker-publish.yml"></a>
  &nbsp;
  <a href="https://github.com/Clickin/Daemun/actions/workflows/test.yml"><img alt="Test workflow status" src="https://img.shields.io/github/actions/workflow/status/Clickin/Daemun/test.yml?label=tests"></a>
  &nbsp;
  <a href="https://github.com/Clickin/Daemun/actions/workflows/docs-publish.yml"><img alt="Docs workflow status" src="https://img.shields.io/github/actions/workflow/status/Clickin/Daemun/docs-publish.yml?label=docs"></a>
</p>

# Features

With features like quick search, bookmarks, weather support, a wide range of integrations and widgets, and a focus on a compact runtime, Daemun is your home entry point for self-hosted services.

- **Fast** - The app runs on a compact Hono server with Vite-built client assets.
- **Secure** - All API requests to backend services are proxied, keeping your API keys hidden. Constantly reviewed for security by the community.
- **For Everyone** - Images built for AMD64, ARM64.
- **Full i18n** - Support for over 40 languages.
- **Service & Web Bookmarks** - Add custom links to the dashboard.
- **Docker Integration** - Container status and stats. Automatic service discovery via labels.
- **Service Integration** - Over 100 service integrations, including popular starr and self-hosted apps.
- **Information & Utility Widgets** - Weather, time, date, search, and more.
- **And much more...**

## Docker Integration

Daemun has built-in support for Docker, and can automatically discover and add services based on labels.

## Service Widgets

Daemun keeps the inherited service widget catalog, including popular \*arr apps and self-hosted apps such as Plex, Jellyfin, Emby, Transmission, qBittorrent, Deluge, Jackett, NZBGet, and SABnzbd.

## Information Widgets

Daemun has built-in support for information providers including weather, time, date, search, Glances, and more.

## Customization

Daemun remains highly customizable, with support for custom themes, custom CSS and JavaScript, layouts, formatting, and localization.

# Getting Started

This fork is Daemun. Some inherited documentation still uses the upstream project name while the docs content is migrated.

## Security Notice 🔒

Please note that when using features such as widgets, Daemun can access personal information (for example from your home automation system) and Daemun currently does not include an authentication layer itself. If Daemun is reachable from any untrusted network, it **must** sit behind a reverse proxy (and/or VPN) that enforces authentication, TLS, and strictly validates Host headers. The built-in host check is a best-effort guard and should not be treated as security when exposed publicly.

## With Docker

Using docker compose:

```yaml
services:
  daemun:
    image: ghcr.io/clickin/daemun:latest
    container_name: daemun
    environment:
      HOMEPAGE_ALLOWED_HOSTS: daemun.example.com # required, may need port
      PUID: 1000 # optional, your user id
      PGID: 1000 # optional, your group id
    ports:
      - 3000:3000
    volumes:
      - /path/to/config:/app/config # Make sure your local config directory exists
      - /var/run/docker.sock:/var/run/docker.sock:ro # optional, for docker integrations
    restart: unless-stopped
```

or docker run:

```bash
docker run --name daemun \
  -e HOMEPAGE_ALLOWED_HOSTS=daemun.example.com \
  -e PUID=1000 \
  -e PGID=1000 \
  -p 3000:3000 \
  -v /path/to/config:/app/config \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --restart unless-stopped \
  ghcr.io/clickin/daemun:latest
```

## From Source

First, clone the repository:

```bash
git clone https://github.com/Clickin/Daemun.git
```

Then install dependencies and build the production bundle:

```bash
pnpm install
pnpm build
```

If this is your first time starting, copy the `src/skeleton` directory to `config/` to populate initial example config files.

Finally, run the server in production mode:

```bash
pnpm start
```

# Configuration

Inherited configuration guides remain under `docs/` while they are migrated into the Astro Starlight documentation site.

# Development

Install NPM packages, this project uses [pnpm](https://pnpm.io/) (and so should you!):

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

This is a Hono application with Vite-built React/Inertia client assets.

# Documentation

Astro Starlight is the documentation runtime:

```bash
pnpm docs:dev
pnpm docs:build
```

The legacy Markdown source is still under `docs/` during the content migration. The Starlight entrypoint is under `docs-site/`.

# Support & Suggestions

If you have any questions, suggestions, or general issues, please start a discussion in the fork repository.

## Troubleshooting

In addition to the docs, the inherited troubleshooting content under `docs/troubleshooting/` can help reveal many basic config or network issues while the Starlight migration continues.

## Contributing & Contributors

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

Thanks to the over 200 contributors who have helped make this project what it is today!

Especially huge thanks to [@shamoon](https://github.com/shamoon), who has been the backbone of this community from the very start.
