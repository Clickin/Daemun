# Upstream Porting Plan

Daemun tracks `gethomepage/homepage` from the supported baseline recorded in
`tools/release-gate/upstream-baseline.json`. Candidate changes are reviewed from
upstream's `dev` branch, but the baseline only advances after the corresponding
Hono and static-rendering contracts are covered locally.

## Current Review

- Supported baseline: `c393e8a4` (`v1.13.2`, captured 2026-08-06).
- Reviewed upstream head: `2b9150bc` (`dev`, 2026-08-05 review).
- No widget drift exists on upstream `main` at the `c393e8a4` baseline.

## Tasks

1. **Portable widget changes — complete**
   - Add the Pulse widget and documentation.
   - Add Dockhand token authentication.
   - Add qBittorrent API-key authentication.
   - Accept Dispatcharr v24 `channel_name` responses.
   - Confirm the Seerr fallback fix is already present.
   - Add the Duplicati, Maintainerr, Sportarr, and Syncthing widgets with
     docs, tests, locale keys, and registry entries.
   - Ignore archived drives in Scrutiny, accept the OMV v8 auth response,
     expand date-only recurring iCal events, correct the WMO 80-82 shower
     icons, simplify qBittorrent API-key handling, and prefer the `status`
     field in Radarr/Sonarr queue details.
2. **Shared proxy behavior — complete**
   - Confirm explicit cookie replacement and redirect/login callers are already
     present with tests in Daemun.
3. **Homepage authentication — complete**
   - Port password and OIDC (authorization-code with PKCE) authentication with
     Hono-signed server sessions and upstream-compatible environment variables.
   - Protect the Hono root and API routes while preserving healthcheck and
     token-authorized MCP access.
   - Cover redirects, signed cookies, healthcheck bypass, and static-home order.
   - Compare passwords by SHA-256 digest (constant-time, multibyte-safe).
4. **MCP endpoint — complete**
   - Port the read-only JSON-RPC tools and config resources independently of
     Next.js; write operations remain deliberately unavailable.
   - Mount Hono transport with opt-in enablement and constant-time bearer /
     header token checks; require a token or an authenticated session.
   - Cover protocol tool exposure and endpoint authorization.
5. **Baseline promotion — complete**
   - Recompared `main` at `c393e8a4` (v1.13.2): no new widgets vs. the
     previous baseline; the Dispatcharr v24 and Seerr fixes were already
     ported. Ported the remaining `main` changes: reduced `/api/validate`
     error output and the Docker HEALTHCHECK `-Y off` fix.
   - Updated the baseline and contract map after all newly introduced tests
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
pnpm gate:docs-parity
```
