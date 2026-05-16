---
title: Daemun Fork Migration
description: Migrating from Homepage to Daemun
---

Daemun is a fork of [gethomepage/homepage](https://github.com/gethomepage/homepage/) that keeps the existing YAML configuration and widget compatibility model while replacing the Next.js runtime with Hono, Vite, and static page baking.

For Docker installs, migration is usually a container image and port change:

```yaml
services:
  daemun:
    image: ghcr.io/clickin/daemun:latest
    ports:
      - 3000:3000
    volumes:
      - /path/to/config:/app/config
```

If you are migrating from the upstream image, change `ghcr.io/gethomepage/homepage:latest` to `ghcr.io/clickin/daemun:latest`. Older `ghcr.io/benphelps/homepage:latest` installations should migrate through the same Daemun image target.

The default Daemun image runs the direct Node/Hono runtime on port `3000`. If you want nginx to serve the baked home page and static assets in front of Daemun, use `ghcr.io/clickin/daemun:latest-nginx` and expose port `80`.

The configuration directory stays `/app/config`, and existing Homepage-style YAML files remain the compatibility contract. For local icons or backgrounds, mount files under `/app/public/icons` or `/app/public/images` and reference them as `/icons/...` or `/images/...`.
