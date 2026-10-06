---
title: What's Up Docker
description: What's Up Docker Widget Configuration
---

Learn more about [What's Up Docker](https://github.com/fmartinou/whats-up-docker).

Allowed fields: `["monitoring", "updates"]`.

```yaml
widget:
  type: whatsupdocker
  url: http://whatsupdocker:port
  key: bearer-token # optional; takes precedence over username and password
  username: username # optional
  password: password # optional
  key: bearer-token # optional, takes precedence over username/password
```
