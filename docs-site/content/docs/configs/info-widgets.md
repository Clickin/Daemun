---
title: Information Widgets
description: Daemun information widget configuration.
---

Information widgets provide dashboard-level information about your system or
environment. They are configured in `widgets.yaml` and are displayed above the
service and bookmark sections.

Each widget has its own detailed page under [Info Widgets](../widgets/info/).

## Available Widgets

- [Date & Time](../widgets/info/datetime/)
- [Glances](../widgets/info/glances/)
- [Greeting](../widgets/info/greeting/)
- [Kubernetes](../widgets/info/kubernetes/)
- [Logo](../widgets/info/logo/)
- [Longhorn](../widgets/info/longhorn/)
- [Open-Meteo](../widgets/info/openmeteo/)
- [OpenWeatherMap](../widgets/info/openweathermap/)
- [Resources](../widgets/info/resources/)
- [Search](../widgets/info/search/)
- [Stocks](../widgets/info/stocks/)
- [UniFi Controller](../widgets/info/unifi_controller/)

## Basic Example

```yaml
- resources:
    cpu: true
    memory: true
    disk: /

- search:
    provider: duckduckgo
    target: _blank
```

## Configuration

Info widgets are defined as top-level entries in `widgets.yaml`. Each widget
has its own options, documented on the widget-specific page.

They are displayed in the order they are defined. Some widgets, including
weather, search, and date/time, are aligned to the right side of the screen, so
their placement can affect the final header layout.

## Adding a Link

You can add a link to an info widget such as the logo or text widgets by adding an `href` option, for example:

```yaml
- logo:
    href: https://example.com
    target: _blank # Optional, can be set in settings
```
