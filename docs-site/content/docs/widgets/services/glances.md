---
title: Glances
description: Glances Widget Configuration
---

Learn more about [Glances](https://github.com/nicolargo/glances).

_(Find the Glances information widget [here](../info/glances/))_

The Glances widget allows you to monitor the resources (cpu, memory, diskio, sensors & processes) of host or another machine. You can have multiple instances by adding another service block.

```yaml
widget:
  type: glances
  url: http://glances.host.or.ip:port
  username: user # optional if auth enabled in Glances
  password: pass # optional if auth enabled in Glances
  version: 4 # required only if running glances v4 or higher, defaults to 3
  metric: cpu
  diskUnits: bytes # optional, bytes (default) or bbytes. Only applies to disk
  refreshInterval: 5000 # optional - in milliseconds, defaults to 1000 or more, depending on the metric
  pointsLimit: 15 # optional, defaults to 15
```

_Please note, this widget does not need an `href`, `icon` or `description` on its parent service. To achieve the same effect as the examples above, see as an example:_

```yaml
- CPU Usage:
    widget:
      type: glances
      url: http://glances.host.or.ip:port
      metric: cpu
- Network Usage:
    widget:
      type: glances
      url: http://glances.host.or.ip:port
      metric: network:enp0s25
```

## Metrics

The metric field in the configuration determines the type of system monitoring data to be displayed. Here are the supported metrics:

`info`: System information. Shows the system's hostname, OS, kernel version, CPU type, CPU usage, RAM usage and SWAP usage.

`cpu`: CPU usage. Shows how much of the system's computational resources are currently being used.

`memory`: Memory usage. Shows how much of the system's RAM is currently being used.

`process`: Top 5 processes based on CPU usage. Gives an overview of which processes are consuming the most resources.

`containers`: Docker or Kubernetes containers list. Shows up to 5 containers running on the system and their resource usage.

`network:<interface_name>`: Network data usage for the specified interface. Replace `<interface_name>` with the name of your network interface, e.g., `network:enp0s25`, as specified in glances.

`sensor:<sensor_id>`: Temperature of the specified sensor, typically used to monitor CPU temperature. Replace `<sensor_id>` with the name of your sensor, e.g., `sensor:Package id 0` as specified in glances.

`disk:<disk_id>`: Disk I/O data for the specified disk. Replace `<disk_id>` with the id of your disk, e.g., `disk:sdb`, as specified in glances.

`gpu:<gpu_id>`: GPU usage for the specified GPU. Replace `<gpu_id>` with the id of your GPU, e.g., `gpu:0`, as specified in glances.

`fs:<mnt_point>`: Disk usage for the specified mount point. Replace `<mnt_point>` with the path of your disk, e.g., `/mnt/storage`, as specified in glances.

## Views

All widgets offer an alternative to the full or "graph" view, which is the compact, or "graphless" view.

To switch to the alternative "graphless" view, simply pass `chart: false` as an option to the widget, like so:

```yaml
- Network Usage:
    widget:
      type: glances
      url: http://glances.host.or.ip:port
      metric: network:enp0s25
      chart: false
```
