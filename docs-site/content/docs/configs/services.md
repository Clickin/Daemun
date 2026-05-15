---
title: Services
description: Service Configuration
---

Services are configured inside the `services.yaml` file. You can have any number of groups, and any number of services per group.

## Groups

Groups are defined as top-level array entries.

```yaml
- Group A:
    - Service A:
        href: http://localhost/

- Group B:
    - Service B:
        href: http://localhost/
```

Daemun renders each top-level entry as a separate service section.

### Nested Groups

Groups can be nested by using the same format as the top-level groups.

```yaml
- Group A:
    - Service A:
        href: http://localhost/

    - Group B:
        - Service B:
            href: http://localhost/

        - Service C:
            href: http://localhost/
```

## Services

Services are defined as array entries on groups,

```yaml
- Group A:
    - Service A:
        href: http://localhost/

    - Service B:
        href: http://localhost/

    - Service C:
        href: http://localhost/

- Group B:
    - Service D:
        href: http://localhost/
```

Daemun renders each service as a card inside its group, using the group order
from `services.yaml` unless a layout override is provided.

### Service Widgets

Each service can have widgets attached to it (often matching the service type, but that's not forced).

In addition to the href of the service, you can also specify the target location in which to open that link. See [Link Target](settings/#link-target) for more details.

Using Emby as an example, this is how you would attach the Emby service widget.

```yaml
- Emby:
    icon: emby.png
    href: http://emby.host.or.ip/
    description: Movies & TV Shows
    widget:
      type: emby
      url: http://emby.host.or.ip
      key: apikeyapikeyapikeyapikeyapikey
```

#### Multiple Widgets

Each service can have multiple widgets attached to it, for example:

```yaml
- Emby:
    icon: emby.png
    href: http://emby.host.or.ip/
    description: Movies & TV Shows
    widgets:
      - type: emby
        url: http://emby.host.or.ip
        key: apikeyapikeyapikeyapikeyapikey
      - type: uptimekuma
        url: http://uptimekuma.host.or.ip:port
        slug: statuspageslug
```

:::note

Multiple widgets per service are not yet supported with Kubernetes ingress annotations.
:::

#### Custom HTTP headers

Widgets that make HTTP calls support extra request headers via `headers`. This is useful when a reverse proxy expects a secret header.

```yaml
- UptimeRobot:
    icon: uptimekuma.png
    href: https://uptimerobot.com/
    widget:
      type: uptimerobot
      url: https://api.uptimerobot.com
      key: ${UPTIMEROBOT_API_KEY}
      headers:
        User-Agent: homepage
        X-Auth-Key: your-secret-here
```

If you define services via Docker labels or Kubernetes annotations, use the same key with dot-notation (for example `homepage.widget.headers.X-Auth-Key=secret` or `gethomepage.dev/widget.headers.X-Auth-Key: "secret"`).

#### Field Visibility

Each widget can optionally provide a list of which fields should be visible via the `fields` widget property. If no fields are specified, then all fields will be displayed. The `fields` property must be a valid YAML array of strings. As an example, here is the entry for Sonarr showing only a couple of fields.

**In all cases a widget will work and display all fields without specifying the `fields` property.**

```yaml
- Sonarr:
    icon: sonarr.png
    href: http://sonarr.host.or.ip
    widget:
      type: sonarr
      fields: ["wanted", "queued"]
      url: http://sonarr.host.or.ip
      key: apikeyapikeyapikeyapikeyapikey
```

### Block Highlighting

Widgets can tint their metric block text automatically based on rules defined alongside the service. Attach a `highlight` section to the widget configuration and map each block to one or more numeric or string rules using the field key (for example, `queued`, `lan_users`).

```yaml
- Sonarr:
    icon: sonarr.png
    href: http://sonarr.host.or.ip
    widget:
      type: sonarr
      url: http://sonarr.host.or.ip
      key: ${SONARR_API_KEY}
      highlight:
        queued:
          numeric:
            - level: danger
              when: gte
              value: 20
            - level: warn
              when: gte
              value: 5
            - level: good
              when: eq
              value: 0
        status:
          string:
            - level: danger
              when: regex
              value: "(failed|import) pending"
            - level: good
              when: equals
              value: "All good"
        status_code:
          string:
            - level: warn
              when: regex
              value: "^5\\d{2}$"
```

Supported numeric operators for the `when` property are `gt`, `gte`, `lt`, `lte`, `eq`, `ne`, `between`, and `outside`. String rules support `equals`, `includes`, `startsWith`, `endsWith`, and `regex`. Each rule can be inverted with `negate: true`, and string rules may pass `caseSensitive: true` or custom regex `flags`. The highlight engine does its best to coerce formatted values, but you will get the most reliable results when you pass plain numbers or strings into `<Block>`.

#### Value Only Highlighting

You can optionally apply highlighting only to the value portion of a block (not the label) by setting `valueOnly: true` on the field configuration. This keeps the label visible while highlighting only the metric value itself.

```yaml
- Sonarr:
    ...
      highlight:
        queued:
          valueOnly: true
          ...
```

## Descriptions

Services may have descriptions,

```yaml
- Group A:
    - Service A:
        href: http://localhost/
        description: This is my service

- Group B:
    - Service B:
        href: http://localhost/
        description: This is another service
```

Descriptions are shown under the service name when the selected card layout has
room for them.

## Icons

Services may have an icon attached to them, you can use icons from [Dashboard Icons](https://github.com/homarr-labs/dashboard-icons) automatically, by passing the name of the icon, with, or without `.png`, `.webp` or `.svg` to specify the desired version.

You can also specify prefixed icons from:

- [Material Design Icons](https://pictogrammers.com/library/mdi/) with `mdi-XX`
- [Simple Icons](https://simpleicons.org/) with `si-XX`
- [selfh.st/icons](https://selfh.st/icons/) with `sh-XX` to use the png version or `sh-XX.svg/png/webp` for a specific version

You can specify a custom color for `mdi` and `si` icons by adding a hex color code as a suffix e.g. `mdi-XX-#f0d453` or `si-XX-#a712a2`.

To use a remote icon, use the absolute URL (e.g. `https://...`).

To use a local icon, first create a Docker mount to `/app/public/icons` and then reference your icon as `/icons/myicon.png`. In the default Docker image, nginx serves that path directly from `/app/public/icons/myicon.png`.

:::caution

Material Design Icons for **brands** were deprecated and may be removed in the future. Using Simple Icons for brand icons will prevent any issues if / when the Material Design Icons are removed.
:::

```yaml
- Group A:
    - Sonarr:
        icon: sonarr.png
        href: http://sonarr.host/
        description: Series management

- Group B:
    - Radarr:
        icon: radarr.png
        href: http://radarr.host/
        description: Movie management

- Group C:
    - Service:
        icon: mdi-flask-outline
        href: http://service.host/
        description: My cool service
```

The example above resolves the Sonarr and Radarr icons from Dashboard Icons and
uses a Material Design icon for the generic service.

## Ping

Services may have an optional `ping` property that allows you to monitor the availability of an external host. As of v0.8.0, the ping feature attempts to use a true (ICMP) ping command on the underlying host. Currently, only IPv4 is supported.

:::note

Because ping uses the ping command on the underlying host, in some cases you may need to install e.g. the `iputils-ping` package on the host system.
:::

```yaml
- Group A:
    - Sonarr:
        icon: sonarr.png
        href: http://sonarr.host/
        ping: sonarr.host

- Group B:
    - Radarr:
        icon: radarr.png
        href: http://radarr.host/
        ping: some.other.host
```

You can also apply different styles to the ping indicator by using the `statusStyle` property, see [settings](settings/#status-style).

## Site Monitor

Services may have an optional `siteMonitor` property (formerly `ping`) that allows you to monitor the availability of a URL you chose and have the response time displayed. You do not need to set your monitor URL equal to your href or ping URL.

:::note

The site monitor feature works by making an http `HEAD` request to the URL, and falls back to `GET` in case that fails. It will not, for example, login if the URL requires auth or is behind e.g. Authelia. In the case of a reverse proxy and/or auth this usually requires the use of an 'internal' URL to make the site monitor feature correctly display status.
:::

```yaml
- Group A:
    - Sonarr:
        icon: sonarr.png
        href: http://sonarr.host/
        siteMonitor: http://sonarr.host/

- Group B:
    - Radarr:
        icon: radarr.png
        href: http://radarr.host/
        siteMonitor: http://some.other.host/
```

You can also apply different styles to the site monitor indicator by using the `statusStyle` property, see [settings](settings/#status-style).

## Docker Integration

Services may be connected to a Docker container, either running on the local machine, or a remote machine.

```yaml
- Group A:
    - Service A:
        href: http://localhost/
        description: This is my service
        server: my-server
        container: my-container

- Group B:
    - Service B:
        href: http://localhost/
        description: This is another service
        server: other-server
        container: other-container
```

**Clicking on the status label of a service with Docker integration enabled will expand the container stats, where you can see CPU, Memory, and Network activity.**

:::note

This can also be controlled with `showStats`. See [show docker stats](docker/#show-stats) for more information
:::

## Service Integrations

Services may also have a service widget (or integration) attached to them, this works independently of the Docker integration.

You can find information and configuration for each of the supported integrations on the [Widgets](../widgets/) page.

Here is an example of a Radarr & Sonarr service, with their respective integrations.

```yaml
- Group A:
    - Sonarr:
        icon: sonarr.png
        href: http://sonarr.host/
        description: Series management
        widget:
          type: sonarr
          url: http://sonarr.host
          key: apikeyapikeyapikeyapikeyapikey

- Group B:
    - Radarr:
        icon: radarr.png
        href: http://radarr.host/
        description: Movie management
        widget:
          type: radarr
          url: http://radarr.host
          key: apikeyapikeyapikeyapikeyapikey
```

The widget appears inside the service card and uses the same server-side proxy
path as other service widgets.
