---
title: qBittorrent
description: qBittorrent Widget Configuration
---

Learn more about [qBittorrent](https://github.com/qbittorrent/qBittorrent).

Uses either an API key or the same username and password used to log in from the web.

Allowed fields: `["leech", "download", "seed", "upload"]`.

```yaml
widget:
  type: qbittorrent
  url: http://qbittorrent.host.or.ip
  key: your-api-key # optional; replaces username/password
  username: username
  password: password
  enableLeechProgress: true # optional, defaults to false
  enableLeechSize: true # optional, defaults to false
```
