---
title: Model Context Protocol
description: Read-only MCP configuration endpoint
---

Daemun can expose a read-only MCP endpoint at `/api/mcp`.

```yaml
HOMEPAGE_MCP_ENABLED: "true"
HOMEPAGE_MCP_TOKEN: "change-me"
```

Send the token as `Authorization: Bearer change-me` or `X-Homepage-MCP-Token: change-me`.
The endpoint provides config-file listing, reading, YAML validation, documentation links, and config resources. It never writes configuration.

The MCP endpoint requires authentication. Requests from an authenticated Homepage session are allowed when `HOMEPAGE_AUTH_ENABLED` is set. For MCP clients that cannot use the browser session, set `HOMEPAGE_MCP_TOKEN` — an MCP token is required when Homepage auth is not enabled.
