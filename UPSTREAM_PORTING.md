# Upstream Porting Plan

Daemun tracks `gethomepage/homepage` from the supported baseline recorded in
`tools/release-gate/upstream-baseline.json`. Candidate changes are reviewed from
upstream's `dev` branch, but the baseline only advances after the corresponding
Hono and static-rendering contracts are covered locally.

## Current Review

- Supported baseline: `233721cc905be3a1eeb995963de14cd8d2a0d614` (`v1.13.1`).
- Reviewed upstream head: `47553881` (`dev`, 2026-07-11 review).
- No widget drift exists on upstream `main`; the items below are unreleased
  upstream development changes.

## Tasks

1. **Portable widget changes — complete**
   - Add the Pulse widget and documentation.
   - Add Dockhand token authentication.
   - Add qBittorrent API-key authentication.
   - Accept Dispatcharr v24 `channel_name` responses.
   - Confirm the Seerr fallback fix is already present.
2. **Shared proxy behavior — complete**
   - Confirm explicit cookie replacement and redirect/login callers are already
     present with tests in Daemun.
3. **Homepage authentication — complete**
   - Port password and OIDC (authorization-code with PKCE) authentication with
     Hono-signed server sessions and upstream-compatible environment variables.
   - Protect the Hono root and API routes while preserving healthcheck and
     token-authorized MCP access.
   - Cover redirects, signed cookies, healthcheck bypass, and static-home order.
4. **MCP endpoint — complete**
   - Port the read-only JSON-RPC tools and config resources independently of
     Next.js; write operations remain deliberately unavailable.
   - Mount Hono transport with opt-in enablement and bearer/header token checks.
   - Cover protocol tool exposure and endpoint authorization.
5. **Baseline promotion — pending upstream release**
   - Recompare `main`, translations, docs, and page/API tests after upstream
     releases these changes.
   - Update the baseline and contract map only after all newly introduced tests
     have local equivalents.

Dependency-only, CI-only, MkDocs, and `next-i18next` import churn are excluded;
Daemun owns those layers separately.

## Verification

For each portable batch, run the focused tests first, followed by:

```bash
pnpm lint
pnpm test
pnpm build
pnpm gate:widgets
pnpm gate:upstream-contracts
```
