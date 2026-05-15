param(
  [int]$Port = 3000,
  [switch]$Build,
  [switch]$Open
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ConfigDir = Join-Path $Root ".omx\sample-config"
$ServerEntry = Join-Path $Root "dist\server\index.mjs"
$ClientManifest = Join-Path $Root "dist\client\.vite\manifest.json"

if ($Build) {
  Push-Location $Root
  try {
    pnpm build
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $ServerEntry) -or -not (Test-Path $ClientManifest)) {
  throw "Build output is missing. Run `pnpm build` first, or run this script with `-Build`."
}

$existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($existing) {
  $pids = ($existing | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
  throw "Port $Port is already in use by PID(s): $pids"
}

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null

@"
---
title: Daemun
description: Static-first homelab dashboard
theme: dark
color: sky
headerStyle: boxedWidgets
statusStyle: dot
target: _self
hideVersion: true
bookmarksStyle: icons
cardBlur: xs
quicklaunch:
  searchDescriptions: true
layout:
  Media:
    icon: mdi-play-box-multiple-outline-#38bdf8
  Infrastructure:
    icon: mdi-server-network-#0ea5e9
  Storage:
    icon: mdi-harddisk-#22c55e
  Automation:
    icon: mdi-home-automation-#f59e0b
  Observability:
    icon: mdi-chart-line-#a78bfa
  Links:
    icon: mdi-link-variant-#f472b6
"@ | Set-Content -Path (Join-Path $ConfigDir "settings.yaml") -Encoding UTF8

@"
---
- Media:
    - Jellyfin:
        href: https://jellyfin.org
        icon: jellyfin.svg
        description: Movies and shows
    - Sonarr:
        href: https://sonarr.tv
        icon: sonarr.svg
        description: Series automation
    - Radarr:
        href: https://radarr.video
        icon: radarr.svg
        description: Movie automation
- Infrastructure:
    - Proxmox:
        href: https://www.proxmox.com
        icon: proxmox.svg
        description: Virtualization
    - Grafana:
        href: https://grafana.com
        icon: grafana.svg
        description: Dashboards
    - Traefik:
        href: https://traefik.io
        icon: traefik.svg
        description: Edge routing
- Storage:
    - TrueNAS:
        href: https://www.truenas.com
        icon: truenas.svg
        description: Files and snapshots
    - Syncthing:
        href: https://syncthing.net
        icon: syncthing.svg
        description: Device sync
- Automation:
    - Home Assistant:
        href: https://www.home-assistant.io
        icon: home-assistant.svg
        description: Smart home
    - Mosquitto:
        href: https://mosquitto.org
        icon: mosquitto.svg
        description: MQTT broker
- Observability:
    - Uptime Kuma:
        href: https://uptime.kuma.pet
        icon: uptime-kuma.svg
        description: Service health
    - Loki:
        href: https://grafana.com/oss/loki/
        icon: mdi-text-box-search-outline-#a78bfa
        description: Logs and traces
"@ | Set-Content -Path (Join-Path $ConfigDir "services.yaml") -Encoding UTF8

@"
---
- Links:
    - Daemun:
        - icon: /daemun.svg
          href: https://github.com/Clickin/Daemun
          description: Runtime
    - Docs:
        - icon: mdi-book-open-page-variant-#38bdf8
          href: https://clickin.github.io/Daemun/
          description: Starlight guide
    - Upstream:
        - icon: mdi-source-fork-#f472b6
          href: https://gethomepage.dev
          description: YAML compatible
"@ | Set-Content -Path (Join-Path $ConfigDir "bookmarks.yaml") -Encoding UTF8

@"
---
- logo:
- greeting:
    text: Daemun
    text_size: 2xl
- search:
    provider:
      - duckduckgo
      - google
      - brave
    target: _self
    showSearchSuggestions: false
- datetime:
    text_size: md
    format:
      dateStyle: medium
      timeStyle: short
"@ | Set-Content -Path (Join-Path $ConfigDir "widgets.yaml") -Encoding UTF8

foreach ($file in @("docker.yaml", "kubernetes.yaml", "proxmox.yaml", "custom.css", "custom.js")) {
  Set-Content -Path (Join-Path $ConfigDir $file) -Value "" -Encoding UTF8
}

$env:DAEMUN_STATIC_HOME = "0"
$env:HOMEPAGE_ALLOWED_HOSTS = "localhost:$Port,127.0.0.1:$Port"
$env:HOMEPAGE_CONFIG_DIR = $ConfigDir
$env:HOSTNAME = "127.0.0.1"
$env:LOG_TARGETS = "stdout"
$env:NODE_ENV = "production"
$env:PORT = [string]$Port

$Url = "http://127.0.0.1:$Port/"
Write-Host "Daemun sample config: $ConfigDir"
Write-Host "Daemun sample URL:    $Url"
Write-Host "Press Ctrl+C in this terminal to stop the server."

if ($Open) {
  Start-Process $Url
}

Push-Location $Root
try {
  node $ServerEntry
} finally {
  Pop-Location
}
