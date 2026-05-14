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
      - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For docker integrations
    environment:
      HOMEPAGE_ALLOWED_HOSTS: localhost:3000 # required, may need port. See the install overview.
```

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
      - /var/run/docker.sock:/var/run/docker.sock:ro # (optional) For docker integrations, see alternative methods
    environment:
      HOMEPAGE_ALLOWED_HOSTS: localhost:3000 # required, may need port. See the install overview.
      PUID: $PUID
      PGID: $PGID
```

### With Docker Run

```bash
docker run -p 3000:3000 -e HOMEPAGE_ALLOWED_HOSTS=localhost:3000 -v /path/to/config:/app/config -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/clickin/daemun:latest
```

### Using Environment Secrets

You can also include environment variables in your config files to protect sensitive information. Note:

- Environment variables must start with `HOMEPAGE_VAR_` or `HOMEPAGE_FILE_`
- The value of env var `HOMEPAGE_VAR_XXX` will replace `{{HOMEPAGE_VAR_XXX}}` in any config
- The value of env var `HOMEPAGE_FILE_XXX` must be a file path, the contents of which will be used to replace `{{HOMEPAGE_FILE_XXX}}` in any config
