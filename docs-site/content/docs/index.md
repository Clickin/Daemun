---
title: Daemun
description: Daemun documentation entrypoint.
---

Daemun is the long-term fork identity for this application dashboard.

The application runtime is Hono on Node 26 with Vite-built React and Inertia
assets. The inherited documentation under `docs/` is being migrated away from
the Python/MkDocs toolchain into this Astro Starlight site.

## Current Scope

- Hono serves the production app and the existing `/api/**` routes.
- Vite builds the browser bundle and the server entry.
- `pnpm` owns app, docs, tests, and build commands.
- Existing `HOMEPAGE_*` environment variables, Docker labels, and Kubernetes
  annotations remain compatibility contracts for now.

## Local Commands

```bash
pnpm dev
pnpm build
pnpm docs:dev
pnpm docs:build
```
