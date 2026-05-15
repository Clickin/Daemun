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
