---
title: qui
description: qui Widget Configuration
---

Learn more about [qui](https://github.com/autobrr/qui).

Generate an API key in qui under **Settings → API Keys**.

By default, the widget shows aggregate stats across all qBittorrent instances monitored by qui. Set `instance` to a qui instance ID to show that instance's stats instead.

```yaml
widget:
  type: qui
  url: http://qui.host.or.ip:7476
  key: quiapikeyquiapikeyquiapikey
  instance: 1 # optional; omit for aggregate stats
  fields: ["leech", "download", "seed", "upload"] # optional
```

Allowed fields: `["leech", "download", "seed", "upload", "total", "errored", "ratio", "freeSpace"]` (maximum of 4).

Default fields: `["leech", "download", "seed", "upload"]`.

`ratio` and `freeSpace` are available only when `instance` is set.
