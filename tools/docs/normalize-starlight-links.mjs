import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultDocsRoot = path.join(root, "docs-site/content/docs");

const markdownLinkPattern = /(!?\[[^\]\n]*\]\()([^)]+?)(\))/giu;
const referenceLinkPattern = /^(\s*\[[^\]\n]+\]:\s*)(\S+)(.*)$/gimu;
const htmlHrefPattern = /(href\s*=\s*["'])([^"']+)(["'])/giu;

export function walkMarkdownDocs(dir = defaultDocsRoot) {
  const entries = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkMarkdownDocs(fullPath));
    } else if (entry.isFile() && /\.(md|mdx)$/iu.test(entry.name)) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function splitTarget(target) {
  const hashIndex = target.indexOf("#");
  const hash = hashIndex === -1 ? "" : target.slice(hashIndex);
  const beforeHash = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex);
  const pathname = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);

  return { hash, pathname, query };
}

function isExternalOrFragment(target) {
  return target.startsWith("#") || target.startsWith("//") || /^[a-z][a-z\d+.-]*:/iu.test(target);
}

export function convertMarkdownRoute(target) {
  if (!target || isExternalOrFragment(target)) return target;

  const { hash, pathname, query } = splitTarget(target);
  if (!/\.(md|mdx)$/iu.test(pathname)) return target;

  let route = pathname.replace(/\.(md|mdx)$/iu, "").replace(/(^|\/)index$/u, "$1");
  if (route === "") route = "./";
  if (!route.endsWith("/")) route = `${route}/`;

  return `${route}${query}${hash}`;
}

export function convertLinkDestination(rawDestination) {
  const leadingWhitespace = rawDestination.match(/^\s*/u)?.[0] ?? "";
  const trailingWhitespace = rawDestination.match(/\s*$/u)?.[0] ?? "";
  const inner = rawDestination.trim();

  if (inner.startsWith("<")) {
    const closeIndex = inner.indexOf(">");
    if (closeIndex === -1) return rawDestination;

    const target = inner.slice(1, closeIndex);
    const suffix = inner.slice(closeIndex + 1);

    return `${leadingWhitespace}<${convertMarkdownRoute(target)}>${suffix}${trailingWhitespace}`;
  }

  const [destination = "", suffix = ""] = inner.match(/^(\S+)(.*)$/su)?.slice(1) ?? [];

  return `${leadingWhitespace}${convertMarkdownRoute(destination)}${suffix}${trailingWhitespace}`;
}

export function normalizeStarlightLinks(text) {
  return text
    .replace(markdownLinkPattern, (_match, prefix, destination, suffix) => {
      return `${prefix}${convertLinkDestination(destination)}${suffix}`;
    })
    .replace(referenceLinkPattern, (_match, prefix, destination, suffix) => {
      return `${prefix}${convertLinkDestination(destination)}${suffix}`;
    })
    .replace(htmlHrefPattern, (_match, prefix, destination, suffix) => {
      return `${prefix}${convertMarkdownRoute(destination)}${suffix}`;
    });
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

export function findLegacyMarkdownLinks(text) {
  const legacyLinks = [];

  const collect = (regex, groupIndex = 2) => {
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match) {
      const destination = match[groupIndex];
      if (destination && convertLinkDestination(destination) !== destination) {
        legacyLinks.push({
          line: lineForOffset(text, match.index),
          target: destination.trim(),
        });
      }
      match = regex.exec(text);
    }
  };

  collect(markdownLinkPattern);
  collect(referenceLinkPattern);
  collect(htmlHrefPattern);

  return legacyLinks;
}

function run() {
  const checkOnly = process.argv.includes("--check");
  const changedFiles = [];

  for (const file of walkMarkdownDocs()) {
    const before = readFileSync(file, "utf8");
    const after = normalizeStarlightLinks(before);
    if (before !== after) {
      changedFiles.push(path.relative(root, file).replaceAll(path.sep, "/"));
      if (!checkOnly) writeFileSync(file, after);
    }
  }

  if (changedFiles.length && checkOnly) {
    console.error(`Docs contain direct Markdown file links:\n${changedFiles.map((file) => `  - ${file}`).join("\n")}`);
    process.exit(1);
  }

  console.log(
    changedFiles.length
      ? `Normalized ${changedFiles.length} docs files to Starlight route links.`
      : "Docs already use Starlight route links.",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
