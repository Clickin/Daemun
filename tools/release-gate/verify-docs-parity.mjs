import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findLegacyMarkdownLinks } from "../docs/normalize-starlight-links.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(root, "docs");
const starlightRoot = path.join(root, "docs-site/content/docs");

const allowedExtraDocs = new Set(["404.md", "stack-migration.md"]);

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

const sourceDocs = new Set(walk(sourceRoot).map((file) => relDoc(file, sourceRoot)));
const starlightFiles = walk(starlightRoot);
const starlightDocs = new Set(starlightFiles.map((file) => relDoc(file, starlightRoot)));

const missing = [...sourceDocs].filter((rel) => !starlightDocs.has(rel));
const unexpected = [...starlightDocs].filter((rel) => !sourceDocs.has(rel) && !allowedExtraDocs.has(rel));
const nulFiles = starlightFiles.filter(hasNullByte).map((file) => relDoc(file, starlightRoot));
const emptyFiles = starlightFiles
  .filter((file) => statSync(file).size === 0)
  .map((file) => relDoc(file, starlightRoot));
const legacyRouteLinks = starlightFiles.flatMap((file) =>
  findLegacyMarkdownLinks(readFileSync(file, "utf8")).map(
    ({ line, target }) => `${relDoc(file, starlightRoot)}:${line} -> ${target}`,
  ),
);

const failures = [];
if (missing.length)
  failures.push(`Missing docs-site files for source docs:\n${missing.map((rel) => `  - ${rel}`).join("\n")}`);
if (unexpected.length)
  failures.push(
    `Unexpected docs-site files without parity allowance:\n${unexpected.map((rel) => `  - ${rel}`).join("\n")}`,
  );
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

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(
  `Daemun docs parity gate passed: ${sourceDocs.size} source docs mapped to ${starlightDocs.size} Starlight docs.`,
);
