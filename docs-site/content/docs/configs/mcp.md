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
