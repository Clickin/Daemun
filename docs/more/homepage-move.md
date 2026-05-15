---
title: Daemun Fork Migration
description: Migrating from Homepage to Daemun
---

Daemun is a fork of [gethomepage/homepage](https://github.com/gethomepage/homepage/) that keeps the existing YAML configuration and widget compatibility model while replacing the Next.js runtime with Hono, Vite, Inertia, and static page baking.

For Docker installs, migration is usually a container image and port change:

```yaml
services:
  daemun:
    image: ghcr.io/clickin/daemun:latest
    ports:
      - 80:80
    volumes:
      - /path/to/config:/app/config
```

If you are migrating from the upstream image, change `ghcr.io/gethomepage/homepage:latest` to `ghcr.io/clickin/daemun:latest`. Older `ghcr.io/benphelps/homepage:latest` installations should migrate through the same Daemun image target.

The default Daemun image serves static files through nginx on port `80` and proxies API requests to the Hono backend over a Unix socket. The direct Node-only image is still available as `ghcr.io/clickin/daemun:latest-node` and listens on port `3000`.

The configuration directory stays `/app/config`, and existing Homepage-style YAML files remain the compatibility contract. For local icons or backgrounds with the default nginx image, mount files under `/app/public/icons` or `/app/public/images` and reference them as `/icons/...` or `/images/...`.
