import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findLegacyMarkdownLinks } from "../docs/normalize-starlight-links.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const starlightRoot = path.join(root, "docs-site/content/docs");
const sampleScreenshot = path.join(root, "public/docs-assets/daemun-sample.png");
const staleSourceRoots = ["docs", "images"];

const minimumMigratedDocs = 190;
const requiredDocs = new Set([
  "index.md",
  "installation/docker.md",
  "installation/k8s.md",
  "installation/source.md",
  "configs/custom-css-js.md",
  "configs/info-widgets.md",
  "configs/services.md",
  "configs/settings.md",
  "widgets/index.md",
  "widgets/info/resources.md",
  "widgets/services/glances.md",
  "widgets/services/index.md",
  "troubleshooting/index.md",
  "stack-migration.md",
]);

function walk(dir) {
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(fullPath));
    } else if (entry.isFile() && /\.(md|mdx)$/u.test(entry.name)) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function relDoc(file, base) {
  return path
    .relative(base, file)
    .replaceAll(path.sep, "/")
    .replace(/\.mdx$/u, ".md");
}

function hasNullByte(file) {
  return readFileSync(file).includes(0);
}

const starlightFiles = walk(starlightRoot);
const starlightDocs = new Set(starlightFiles.map((file) => relDoc(file, starlightRoot)));

const missingRequiredDocs = [...requiredDocs].filter((rel) => !starlightDocs.has(rel));
const nulFiles = starlightFiles.filter(hasNullByte).map((file) => relDoc(file, starlightRoot));
const emptyFiles = starlightFiles
  .filter((file) => statSync(file).size === 0)
  .map((file) => relDoc(file, starlightRoot));
const legacyRouteLinks = starlightFiles.flatMap((file) =>
  findLegacyMarkdownLinks(readFileSync(file, "utf8")).map(
    ({ line, target }) => `${relDoc(file, starlightRoot)}:${line} -> ${target}`,
  ),
);
const staleRoots = staleSourceRoots.filter((rel) => existsSync(path.join(root, rel)));

const failures = [];
if (starlightDocs.size < minimumMigratedDocs) {
  failures.push(`Starlight docs count dropped below ${minimumMigratedDocs}: ${starlightDocs.size}`);
}
if (missingRequiredDocs.length) {
  failures.push(
    `Required migrated Starlight docs are missing:\n${missingRequiredDocs.map((rel) => `  - ${rel}`).join("\n")}`,
  );
}
if (nulFiles.length)
  failures.push(`Docs-site files contain NUL bytes:\n${nulFiles.map((rel) => `  - ${rel}`).join("\n")}`);
if (emptyFiles.length) failures.push(`Docs-site files are empty:\n${emptyFiles.map((rel) => `  - ${rel}`).join("\n")}`);
if (legacyRouteLinks.length) {
  failures.push(
    `Docs-site files still link directly to Markdown files instead of Starlight routes:\n${legacyRouteLinks
      .map((rel) => `  - ${rel}`)
      .join("\n")}`,
  );
}
if (staleRoots.length) {
  failures.push(
    `Legacy upstream documentation asset roots should not be tracked at repo root:\n${staleRoots
      .map((rel) => `  - ${rel}/`)
      .join("\n")}`,
  );
}
if (!existsSync(sampleScreenshot) || statSync(sampleScreenshot).size < 10_000) {
  failures.push("Daemun docs sample screenshot is missing or too small; regenerate it with `pnpm docs:assets`.");
}
if (existsSync(path.join(root, "public/docs-assets/daemun-sample.svg"))) {
  failures.push("Daemun docs sample must be a live app screenshot, not the old generated SVG mock.");
}

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(
  `Daemun docs parity gate passed: ${starlightDocs.size} Starlight docs verified with no legacy root docs/images.`,
);
