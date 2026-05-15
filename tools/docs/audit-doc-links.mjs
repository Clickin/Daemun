import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docsRoot = path.join(root, "docs-site/content/docs");
const docsBase = "/Daemun";
const markdownExtensions = new Set([".md", ".mdx"]);

const inlineLinkPattern = /(!?)\[[^\]\n]*\]\(([^)\n]+)\)/giu;
const referenceLinkPattern = /^\s*\[[^\]\n]+\]:\s*(\S+)/gimu;
const htmlHrefPattern = /\bhref\s*=\s*["']([^"']+)["']/giu;
const htmlIdPattern = /\bid\s*=\s*["']([^"']+)["']/giu;
const headingPattern = /^#{1,6}\s+(.+?)\s*#*\s*$/gmu;
const codeFencePattern = /```[\s\S]*?```/gu;

function walkDocs(dir = docsRoot) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDocs(fullPath));
    } else if (entry.isFile() && markdownExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function stripCodeFences(text) {
  return text.replace(codeFencePattern, (match) => "\n".repeat(match.split("\n").length - 1));
}

function routeForFile(filePath) {
  const rel = path
    .relative(docsRoot, filePath)
    .replaceAll(path.sep, "/")
    .replace(/\.(md|mdx)$/iu, "");
  if (rel === "index") return "/";
  if (rel.endsWith("/index")) return `/${rel.slice(0, -"/index".length)}/`;
  return `/${rel}/`;
}

function linkBaseRouteForFile(filePath) {
  const relDir = path.relative(docsRoot, path.dirname(filePath)).replaceAll(path.sep, "/");
  return relDir ? `/${relDir}/` : "/";
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function isExternal(target) {
  return target.startsWith("//") || /^[a-z][a-z\d+.-]*:/iu.test(target);
}

function splitTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<")) {
    const closeIndex = target.indexOf(">");
    if (closeIndex !== -1) target = target.slice(1, closeIndex);
  }

  const hashIndex = target.indexOf("#");
  const hash = hashIndex === -1 ? "" : decodeURIComponent(target.slice(hashIndex + 1));
  const beforeHash = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const pathname = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);

  return { hash, pathname };
}

function normalizeRoutePath(routePath) {
  let normalized = routePath.replaceAll("\\", "/");
  if (normalized.startsWith(`${docsBase}/`)) normalized = normalized.slice(docsBase.length);
  if (normalized === docsBase) normalized = "/";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  normalized = path.posix.normalize(normalized);
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (!normalized.endsWith("/")) normalized = `${normalized}/`;
  return normalized;
}

function resolveRoute(currentRoute, baseRoute, targetPathname) {
  if (!targetPathname) return currentRoute;
  if (targetPathname === "." || targetPathname === "./") return baseRoute;
  if (targetPathname.startsWith("/")) return normalizeRoutePath(targetPathname);

  return normalizeRoutePath(path.posix.join(baseRoute, targetPathname));
}

function shouldCheckRoute(pathname) {
  if (!pathname || pathname === ".") return true;
  if (pathname.startsWith(`${docsBase}/`) || pathname.startsWith("/")) return true;
  if (/\.[a-z0-9]+$/iu.test(pathname)) return false;
  return true;
}

function isMarkdownFileLink(pathname) {
  return /\.(md|mdx)$/iu.test(pathname);
}

function slugifyHeading(heading) {
  return heading
    .replace(/<[^>]+>/gu, "")
    .replace(/[`*~[\]().,:!?/\\]/gu, "")
    .replace(/&amp;/gu, "and")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, "-");
}

function anchorsForContent(content) {
  const stripped = stripCodeFences(content);
  const anchors = new Set();
  const slugCounts = new Map();

  let idMatch = htmlIdPattern.exec(stripped);
  while (idMatch) {
    anchors.add(idMatch[1]);
    idMatch = htmlIdPattern.exec(stripped);
  }

  let headingMatch = headingPattern.exec(stripped);
  while (headingMatch) {
    const baseSlug = slugifyHeading(headingMatch[1]);
    if (!baseSlug) {
      headingMatch = headingPattern.exec(stripped);
      continue;
    }
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`);
    headingMatch = headingPattern.exec(stripped);
  }

  return anchors;
}

function collectLinks(filePath, content) {
  const stripped = stripCodeFences(content);
  const links = [];

  let inlineMatch = inlineLinkPattern.exec(stripped);
  while (inlineMatch) {
    if (inlineMatch[1] !== "!") {
      links.push({
        line: lineForOffset(stripped, inlineMatch.index),
        target: inlineMatch[2],
      });
    }
    inlineMatch = inlineLinkPattern.exec(stripped);
  }

  let referenceMatch = referenceLinkPattern.exec(stripped);
  while (referenceMatch) {
    links.push({
      line: lineForOffset(stripped, referenceMatch.index),
      target: referenceMatch[1],
    });
    referenceMatch = referenceLinkPattern.exec(stripped);
  }

  let hrefMatch = htmlHrefPattern.exec(stripped);
  while (hrefMatch) {
    links.push({
      line: lineForOffset(stripped, hrefMatch.index),
      target: hrefMatch[1],
    });
    hrefMatch = htmlHrefPattern.exec(stripped);
  }

  return links.map((link) => ({ ...link, filePath }));
}

const files = walkDocs();
const routeAnchors = new Map();
const routes = new Set();
const errors = [];

for (const filePath of files) {
  const route = routeForFile(filePath);
  routes.add(route);
  routeAnchors.set(route, anchorsForContent(readFileSync(filePath, "utf8")));
}

for (const filePath of files) {
  const currentRoute = routeForFile(filePath);
  const baseRoute = linkBaseRouteForFile(filePath);
  const content = readFileSync(filePath, "utf8");

  for (const link of collectLinks(filePath, content)) {
    const target = link.target.trim();
    if (!target || isExternal(target)) continue;

    const { hash, pathname } = splitTarget(target);
    if (isMarkdownFileLink(pathname)) {
      errors.push(`${relativePath(filePath)}:${link.line}: markdown file link should use a Starlight route ${target}`);
      continue;
    }

    if (!shouldCheckRoute(pathname)) continue;

    const route = resolveRoute(currentRoute, baseRoute, pathname);
    if (!routes.has(route)) {
      errors.push(`${relativePath(filePath)}:${link.line}: missing docs route ${target} -> ${route}`);
      continue;
    }

    if (hash && !routeAnchors.get(route)?.has(hash)) {
      errors.push(`${relativePath(filePath)}:${link.line}: missing docs anchor ${target} -> ${route}#${hash}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Docs link audit failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Docs link audit passed: ${files.length} source docs checked.`);
