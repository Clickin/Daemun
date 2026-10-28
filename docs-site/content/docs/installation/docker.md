---
title: Docker Installation
description: Install and run Daemun from Docker
---

Using docker compose:

```yaml
services:
  daemun:
    image: ghcr.io/clickin/daemun:latest
    container_name: daemun
    ports:
      - 3000:3000
    volumes:
      - /path/to/config:/app/config # Make sure your local config directory exists
      - /path/to/icons:/app/public/icons:ro # (optional) For local service icons
      - /path/to/images:/app/public/images:ro # (optional) For local backgrounds
      - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For docker integrations
    environment:
      HOMEPAGE_ALLOWED_HOSTS: localhost:3000 # required. See the install overview.
```

The default image runs the direct Node/Hono runtime on port `3000`. If you want
nginx to serve the baked home page and static assets in front of Daemun, use
`ghcr.io/clickin/daemun:latest-nginx` and expose `80:80`.

Pre-release branch images are tagged as `main`, `main-nginx`, and
`main-nginx-caged`. The default branch also publishes `latest`, `latest-nginx`,
and `latest-nginx-caged`. Releases publish versioned tags such as `v1.14.0`,
`v1.14.0-nginx`, and `v1.14.0-nginx-caged`.

### Experimental nginx + node-caged image

Use `ghcr.io/clickin/daemun:latest-nginx-caged` for nginx with
[Platformatic's pointer-compressed Node.js](https://github.com/platformatic/node-caged).
It uses the same configuration, mounts, and port `80` as the nginx image:

```yaml
services:
  daemun:
    image: ghcr.io/clickin/daemun:latest-nginx-caged
    ports:
      - 3000:80
    volumes:
      - /path/to/config:/app/config
    environment:
      HOMEPAGE_ALLOWED_HOSTS: localhost:3000
```

The published variant pins `platformatic/node-caged:26.12.1-alpine` by digest,
retaining the Node.js 26.12.1 security baseline rather than following a floating
`26-alpine` tag. Docker Hub publishes this version for both `linux/amd64` and
`linux/arm64`. The upstream image uses Alpine 3.21 and is **experimental**;
the regular nginx image remains on the official Node.js Alpine 3.23 image.
Alpine keeps the existing `apk` packages and `su-exec` entrypoint compatible
without introducing a separate Dockerfile.

Limitations:

- Pointer compression limits each V8 isolate's heap to about 4 GiB. It can
  reduce JavaScript heap usage, but total container memory savings depend on
  the workload.
- Native addons using V8 directly or NAN, including `better-sqlite3`, can
  crash under this runtime. Do not add those addons to the caged image or
  mount a host `node_modules` directory into it. N-API compatibility still
  depends on the addon's platform and libc support.
- Daemun currently has no `better-sqlite3` dependency and its
  `runtime-deps/package.json` dependencies are empty. CI images copy the
  bundled application, not build-time `node_modules`, and reject nonempty
  runtime dependencies. The lockfile's optional `ssh2` NAN/`cpu-features`
  entries do not mean those native binaries are shipped: Vite replaces
  `cpu-features` with a JavaScript shim, while `ssh2` falls back when its
  optional `sshcrypto.node` binary is absent. Recheck the final image for
  native binaries and exercise affected integrations whenever dependencies
  change; use the regular nginx image if a required addon is incompatible.

To build this variant locally with the existing nginx Dockerfile:

```bash
docker build -f Dockerfile.nginx \
  --build-arg NODE_IMAGE=platformatic/node-caged:26.12.1-alpine@sha256:fe8ec90570374d012cc8a61a5f19e7fadd8621b97f9690126de15425549ae02f \
  -t daemun:nginx-caged .
```

For prebuilt `dist` output, use `Dockerfile.nginx.ci` with the same build argument.
Both Dockerfiles reject caged runtimes older than Node.js 26.12.1 or built
without V8 pointer compression.

### Static Files

Daemun serves static files from `/app/public` inside the container. Mount only
the subdirectories you need, rather than replacing the entire `/app/public`
directory.

Common mounts:

```yaml
volumes:
  - /path/to/icons:/app/public/icons:ro
  - /path/to/images:/app/public/images:ro
```

Then reference those files by their public path:

```yaml
background: /images/background.png

- Media:
    - Jellyfin:
        icon: /icons/jellyfin.png
        href: https://jellyfin.example.com
```

In this example, Daemun serves `/icons/jellyfin.png` from
`/app/public/icons/jellyfin.png` and `/images/background.png` from
`/app/public/images/background.png`.

If a running container has `/docker-entrypoint.sh` at the filesystem root and no
`/app` directory, it is an upstream nginx image, not the Daemun nginx image.
Check the image field and use a `ghcr.io/clickin/daemun:*` tag.

### Running as non-root

By default, the Daemun container runs as root. Daemun also supports running your container as non-root via the standard `PUID` and `PGID` environment variables. When using these variables, make sure that any volumes mounted in to the container have the correct ownership and permissions set.

_Using the docker socket directly is not the recommended method of integration and requires either running Daemun as root or that the user be part of the docker group_

In the docker compose example below, the environment variables `$PUID` and `$PGID` are set in a `.env` file.

```yaml
services:
  daemun:
    image: ghcr.io/clickin/daemun:latest
    container_name: daemun
    ports:
      - 3000:3000
    volumes:
      - /path/to/config:/app/config # Make sure your local config directory exists
      - /path/to/icons:/app/public/icons:ro # (optional) For local service icons
      - /path/to/images:/app/public/images:ro # (optional) For local backgrounds
      - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For docker integrations, see alternative methods
    environment:
      HOMEPAGE_ALLOWED_HOSTS: localhost:3000 # required. See the install overview.
      PUID: $PUID
      PGID: $PGID
```

### With Docker Run

```bash
docker run -p 3000:3000 -e HOMEPAGE_ALLOWED_HOSTS=localhost:3000 -v /path/to/config:/app/config -v /path/to/icons:/app/public/icons:ro -v /path/to/images:/app/public/images:ro -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/clickin/daemun:latest
```

### Using Environment Secrets

You can also include environment variables in your config files to protect sensitive information. Note:

- Environment variables must start with `HOMEPAGE_VAR_` or `HOMEPAGE_FILE_`
- The value of env var `HOMEPAGE_VAR_XXX` will replace `{{HOMEPAGE_VAR_XXX}}` in any config
- The value of env var `HOMEPAGE_FILE_XXX` must be a file path, the contents of which will be used to replace `{{HOMEPAGE_FILE_XXX}}` in any config
