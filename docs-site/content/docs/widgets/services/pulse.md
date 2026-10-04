---
title: Pulse
description: Pulse Widget Configuration
---

Learn more about [Pulse](https://github.com/rcourtman/Pulse).

The widget shows active and total node, VM, and LXC counts. Pulse v6 uses the summary API and requires `version: 2`; older versions default to `version: 1`.

Allowed fields: `["nodes", "vms", "lxcs"]`.

```yaml
widget:
  type: pulse
  url: http://pulse.host.or.ip
  key: pulse-api-token
  version: 2 # use for Pulse v6; defaults to 1
```
