import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDocsAssets = path.join(root, "public/docs-assets");
const shouldRenderRaster = process.argv.includes("--raster");

function runSharpCli(input, output, width, height = width) {
  const pnpmArgs = ["dlx", "sharp-cli", "-i", input, "-o", output, "-f", "png", "resize", String(width), String(height)];
  const command = process.env.npm_execpath ? process.execPath : process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const args = process.env.npm_execpath ? [process.env.npm_execpath, ...pnpmArgs] : pnpmArgs;
  const result = spawnSync(command, args, {
    cwd: root,
    shell: !process.env.npm_execpath && process.platform === "win32",
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`sharp-cli failed for ${path.relative(root, output)} with exit code ${result.status}`);
  }
}

function card(x, y, width, height, title, subtitle, accent) {
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${width}" height="${height}" rx="18" fill="#17202d" stroke="#263446"/>
      <circle cx="34" cy="34" r="13" fill="${accent}"/>
      <text x="58" y="39" fill="#f7fafc" font-size="24" font-weight="700">${title}</text>
      <text x="26" y="78" fill="#9aa8b7" font-size="16">${subtitle}</text>
      <rect x="26" y="${height - 54}" width="${width - 52}" height="9" rx="5" fill="#273346"/>
      <rect x="26" y="${height - 54}" width="${Math.round((width - 52) * 0.64)}" height="9" rx="5" fill="${accent}"/>
    </g>`;
}

function sampleSvg() {
  const serviceCards = [
    card(92, 260, 336, 160, "Media", "Jellyfin, Sonarr, Radarr", "#22c55e"),
    card(460, 260, 336, 160, "Infrastructure", "Proxmox, Grafana, Traefik", "#38bdf8"),
    card(828, 260, 336, 160, "Storage", "NAS, Backups, Sync", "#f59e0b"),
    card(92, 452, 336, 160, "Automation", "Home Assistant, MQTT", "#a78bfa"),
    card(460, 452, 336, 160, "Monitoring", "Glances, Uptime, Logs", "#fb7185"),
    card(828, 452, 336, 160, "Links", "Docs, Git, Homelab", "#2dd4bf"),
  ].join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1280" y2="720" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0a0f17"/>
      <stop offset=".55" stop-color="#101827"/>
      <stop offset="1" stop-color="#111315"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6ed7ff"/>
      <stop offset="1" stop-color="#0072ce"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="64" y="52" width="1152" height="616" rx="28" fill="#0f1622" stroke="#263446"/>
  <g transform="translate(92 82)">
    <rect width="72" height="72" rx="18" fill="url(#mark)"/>
    <path d="M17 31c6-1 10-5 12-10 4 3 18 3 22 0 2 5 6 9 12 10-1 6-5 9-10 7-5-1-10-2-17-2s-12 1-17 2c-5 2-9-1-10-7Z" fill="#fff"/>
    <path d="M22 39h28v5h-3v18h-6V44H31v18h-6V44h-3v-5Z" fill="#fff"/>
    <path d="M32 46h8v17h-8V46Z" fill="#fff"/>
    <text x="96" y="31" fill="#f8fafc" font-size="38" font-weight="800">Daemun</text>
    <text x="96" y="61" fill="#9aa8b7" font-size="18">Static-first homelab dashboard</text>
  </g>
  <g transform="translate(904 96)">
    <rect width="260" height="46" rx="23" fill="#141d2a" stroke="#263446"/>
    <text x="24" y="30" fill="#9aa8b7" font-size="16">Search services...</text>
  </g>
  ${serviceCards}
  <g transform="translate(92 636)">
    <text fill="#6ed7ff" font-size="16" font-weight="700">nginx + Hono</text>
    <text x="118" fill="#9aa8b7" font-size="16">YAML config baked into the first page, widgets refreshed through API calls.</text>
  </g>
</svg>
`;
}

function main() {
  mkdirSync(publicDocsAssets, { recursive: true });
  const svgPath = path.join(publicDocsAssets, "daemun-sample.svg");
  writeFileSync(svgPath, sampleSvg());

  if (shouldRenderRaster) {
    runSharpCli(svgPath, path.join(publicDocsAssets, "daemun-sample.png"), 1280, 720);
  } else {
    console.log("Generated docs SVG assets. Run `pnpm docs:assets:raster` to refresh PNG assets.");
  }
}

main();
