---
title: Resources
description: Resources Information Widget Configuration
---

You can include all or some of the available resources. If you do not want to see that resource, simply pass `false`.

The disk path is the path reported by `df` (Mounted On), or the mount point of the disk.

:::note

Any disk you wish to access must be mounted to your container as a volume.
:::

The cpu and memory resource information are the container's usage while [glances](glances/) displays statistics for the host machine on which it is installed.

The resources widget primarily relies on a popular tool called [systeminformation](https://systeminformation.io). Thus, any limitations of that software apply, for example, Btrfs RAID is not supported for disk usage. In this case users may want to use the [glances widget](glances/) instead.

:::caution

The package used for getting CPU temp ([systeminformation](https://systeminformation.io)) is not compatible with some setups and will not report any value(s) for CPU temp.
:::

```yaml
- resources:
    cpu: true
    memory: true
    disk: /disk/mount/path
    cputemp: true
    tempmin: 0 # optional, minimum cpu temp
    tempmax: 100 # optional, maximum cpu temp
    uptime: true
    units: imperial # only used by cpu temp, options: 'imperial' or 'metric'
    refresh: 3000 # optional, in ms
    diskUnits: bytes # optional, bytes (default) or bbytes. Only applies to disk
    network: true # optional, uses 'default' if true or specify a network interface name
```

You can also pass a `label` option, which allows you to group resources under named sections,

```yaml
- resources:
    label: System
    cpu: true
    memory: true

- resources:
    label: Storage
    disk: /mnt/storage
```

Daemun renders each `label` as a separate resource section.

If you have more than a single disk and would like to group them together under the same label, you can pass an array of paths instead,

```yaml
- resources:
    label: Storage
    disk:
      - /mnt/storage
      - /mnt/backup
      - /mnt/media
```

The paths are grouped under the same `Storage` label.

You can additionally supply an optional `expanded` property set to true in order to show additional details about the resources. By default the expanded property is set to false when not supplied.

```yaml
- resources:
    label: Array Disks
    expanded: true
    disk:
      - /disk1
      - /disk2
      - /disk3
```

The expanded view includes additional per-disk details in the same resource
section.

To monitor a named host network interface in Docker (for example `network: eno1`), mount host `/sys` (read-only):

```yaml
volumes:
  - /sys:/sys:ro
```
