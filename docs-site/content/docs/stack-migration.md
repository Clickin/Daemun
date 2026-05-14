---
title: Stack Migration
description: Runtime and documentation migration notes for the Daemun fork.
---

Daemun keeps the application behavior while removing framework and project
identity that belonged to the upstream Next.js runtime.

## Current Baseline

- App runtime: Hono on Node 26 with Vite-built React/Inertia assets.
- Package manager: pnpm.
- Docs package: `@daemun/docs` in the pnpm workspace.
- Configuration and service discovery: inherited YAML, Docker labels, and
  Kubernetes annotations remain compatible.
- Docs runtime: Astro Starlight, built with the same JavaScript toolchain as the
  application.

## Naming Direction

- Package name: `daemun`.
- Repository: `https://github.com/Clickin/Daemun`.
- Container image target: `ghcr.io/clickin/daemun`.
- User-facing copy should use Daemun unless it is documenting compatibility
  labels, environment variables, or upstream historical behavior.

## Follow-Up Slices

1. Move inherited `docs/` content into Starlight pages.
2. Replace MkDocs-specific admonitions, snippets, tabs, and theme overrides with
   Starlight-compatible Markdown or components.
3. Keep compatibility env vars only while deployment contracts depend on them.
4. Continue using `txml` for read-only XML parsing; introduce `stax-xml` only if
   XML writing or streaming becomes a runtime requirement.

## Verification Gates

```bash
pnpm lint
pnpm test
pnpm build
pnpm docs:build
```
