import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDocsAssets = path.join(root, "public/docs-assets");
const screenshotPath = path.join(publicDocsAssets, "daemun-sample.png");
const viewport = { width: 1280, height: 720 };

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not allocate a local TCP port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function writeSampleConfig(configDir) {
  mkdirSync(configDir, { recursive: true });

  writeFileSync(
    path.join(configDir, "settings.yaml"),
    `---
title: Daemun
description: Static-first homelab dashboard
theme: dark
color: slate
headerStyle: boxed
statusStyle: dot
target: _self
hideVersion: true
quicklaunch:
  searchDescriptions: true
layout:
  Media:
    icon: mdi-movie-open
  Infrastructure:
    icon: mdi-server-network
  Storage:
    icon: mdi-harddisk
  Automation:
    icon: mdi-home-automation
  Observability:
    icon: mdi-chart-line
  Links:
    icon: mdi-link-variant
`,
  );

  writeFileSync(
    path.join(configDir, "services.yaml"),
    `---
- Media:
    - Jellyfin:
        href: https://jellyfin.org
        description: Movies and shows
    - Sonarr:
        href: https://sonarr.tv
        description: Series automation
- Infrastructure:
    - Proxmox:
        href: https://www.proxmox.com
        description: Virtualization
    - Grafana:
        href: https://grafana.com
        description: Metrics
- Storage:
    - NAS:
        href: https://example.com/nas
        description: Files and backups
    - Sync:
        href: https://example.com/sync
        description: Replication
- Automation:
    - Home Assistant:
        href: https://www.home-assistant.io
        description: Smart home
- Observability:
    - Logs:
        href: https://example.com/logs
        description: Events and traces
`,
  );

  writeFileSync(
    path.join(configDir, "bookmarks.yaml"),
    `---
- Links:
    - Daemun:
        - abbr: DM
          href: https://github.com/Clickin/Daemun
          description: Fork runtime
    - Upstream:
        - abbr: HP
          href: https://gethomepage.dev
          description: Compatibility reference
`,
  );

  writeFileSync(
    path.join(configDir, "widgets.yaml"),
    `---
- search:
    provider: duckduckgo
    target: _self
- datetime:
    text_size: xl
- resources:
    cpu: true
    memory: true
    disk: /
`,
  );

  for (const file of ["docker.yaml", "kubernetes.yaml", "proxmox.yaml", "custom.css", "custom.js"]) {
    writeFileSync(path.join(configDir, file), "");
  }
}

function assertBuilt() {
  const serverEntry = path.join(root, "dist/server/index.mjs");
  const clientManifest = path.join(root, "dist/client/.vite/manifest.json");
  if (!existsSync(serverEntry) || !existsSync(clientManifest)) {
    throw new Error("Build output is missing. Run `pnpm build` before generating docs screenshots.");
  }
}

function waitForProcessExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", resolve);
  });
}

async function terminateProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill();
  await Promise.race([waitForProcessExit(child), delay(5_000)]);
}

function startDaemun(configDir, port) {
  const child = spawn(process.execPath, ["dist/server/index.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      DAEMUN_STATIC_HOME: "0",
      HOMEPAGE_ALLOWED_HOSTS: `localhost:${port},127.0.0.1:${port}`,
      HOMEPAGE_CONFIG_DIR: configDir,
      HOSTNAME: "127.0.0.1",
      LOG_TARGETS: "stdout",
      NODE_ENV: "production",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return {
    child,
    getOutput: () => output.trim(),
    async close() {
      await terminateProcess(child);
    },
  };
}

async function waitForHttp(url, server) {
  const deadline = Date.now() + 20_000;
  let lastError;

  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(`Daemun exited before serving ${url}:\n${server.getOutput()}`);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "unknown error"}\n${server.getOutput()}`);
}

function findCommandOnPath(command) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  const result = spawn(lookup, [command], { stdio: ["ignore", "pipe", "ignore"] });

  return new Promise((resolve) => {
    let stdout = "";
    result.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    result.once("exit", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      resolve(
        stdout
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .find(Boolean) ?? null,
      );
    });
  });
}

async function browserCandidates() {
  const candidates = [];
  if (process.env.DAEMUN_DOCS_BROWSER_BIN) candidates.push(process.env.DAEMUN_DOCS_BROWSER_BIN);

  if (process.platform === "win32") {
    for (const base of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (!base) continue;
      candidates.push(
        path.join(base, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(base, "Chromium", "Application", "chrome.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      await findCommandOnPath("google-chrome-stable"),
      await findCommandOnPath("google-chrome"),
      await findCommandOnPath("chromium"),
      await findCommandOnPath("chromium-browser"),
      await findCommandOnPath("microsoft-edge"),
    );
  }

  return candidates.filter((candidate, index, all) => candidate && all.indexOf(candidate) === index);
}

async function captureWithBrowser(executable, baseUrl) {
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), "daemun-docs-browser-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-javascript",
    "--no-sandbox",
    `--screenshot=${screenshotPath}`,
    "--timeout=5000",
    `--user-data-dir=${userDataDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    baseUrl,
  ];
  rmSync(screenshotPath, { force: true });

  const result =
    process.platform === "win32"
      ? spawnSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `
$stdout = Join-Path $env:TEMP ("daemun-docs-browser-" + [guid]::NewGuid() + ".out")
$stderr = Join-Path $env:TEMP ("daemun-docs-browser-" + [guid]::NewGuid() + ".err")
$argLine = ${JSON.stringify(args.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg)).join(" "))}
$p = Start-Process -FilePath ${JSON.stringify(executable)} -ArgumentList $argLine -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
if (-not $p.WaitForExit(30000)) {
  $p.Kill()
  Write-Output "Timed out capturing screenshot with ${executable.replaceAll("\\", "\\\\")}"
  exit 124
}
if (Test-Path $stdout) { Get-Content $stdout -Raw }
if (Test-Path $stderr) { Get-Content $stderr -Raw }
Remove-Item $stdout,$stderr -Force -ErrorAction SilentlyContinue
exit $p.ExitCode
`,
          ],
          {
            encoding: "utf8",
            timeout: 40_000,
          },
        )
      : spawnSync(executable, args, {
          encoding: "utf8",
          timeout: 30_000,
        });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

  rmSync(userDataDir, { force: true, recursive: true });

  if (result.error) {
    throw new Error(`Chrome screenshot capture failed: ${result.error.message}\n${output}`);
  }
  if (result.status !== 0) {
    throw new Error(`Chrome screenshot capture failed with exit code ${result.status}:\n${output}`);
  }
  if (!existsSync(screenshotPath) || statSync(screenshotPath).size < 10_000) {
    throw new Error(`Chrome did not create a usable screenshot:\n${output}`);
  }

  console.log(`Captured real Daemun dashboard screenshot with ${executable}`);
}

async function captureScreenshot(baseUrl) {
  const candidates = (await browserCandidates()).filter((candidate) => candidate && existsSync(candidate));
  if (!candidates.length) {
    throw new Error(
      "No Chrome, Edge, or Chromium executable found. Set DAEMUN_DOCS_BROWSER_BIN to generate screenshots.",
    );
  }

  const failures = [];
  for (const executable of candidates) {
    try {
      await captureWithBrowser(executable, baseUrl);
      return;
    } catch (error) {
      failures.push(`${executable}: ${error.message}`);
    }
  }

  throw new Error(`No browser could capture the Daemun screenshot:\n${failures.join("\n\n")}`);
}

async function main() {
  console.log("Preparing Daemun docs screenshot capture...");
  assertBuilt();
  mkdirSync(publicDocsAssets, { recursive: true });

  const configDir = mkdtempSync(path.join(os.tmpdir(), "daemun-docs-config-"));
  const port = await getFreePort();
  console.log(`Starting Daemun on 127.0.0.1:${port} with sample config.`);
  const server = startDaemun(configDir, port);

  try {
    writeSampleConfig(configDir);
    console.log("Waiting for Daemun healthcheck...");
    await waitForHttp(`http://127.0.0.1:${port}/api/healthcheck`, server);
    console.log("Launching headless browser for screenshot...");
    await captureScreenshot(`http://127.0.0.1:${port}/`);
    console.log(`Generated ${path.relative(root, screenshotPath).replaceAll(path.sep, "/")} from a live Daemun app.`);
  } finally {
    await server.close();
    rmSync(configDir, { force: true, recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
