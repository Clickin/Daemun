---
title: Pulse
description: Pulse Widget Configuration
---

Learn more about [Pulse](https://github.com/rcourtman/Pulse).

The widget shows active and total node, VM, and LXC counts.

Allowed fields: `["nodes", "vms", "lxcs"]`.

```yaml
widget:
  type: pulse
  url: http://pulse.host.or.ip
  key: pulse-api-token
```
