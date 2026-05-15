import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const docsContentDir = path.join(root, "docs-site/content");
const publicDocsAssetsDir = path.join(root, "public/docs-assets");
const distDocsDir = path.join(root, "dist-docs");

const allowedDocsAssets = new Set(["daemun-sample.png"]);
const forbiddenAssetFragments = [
  "github.com/gethomepage/homepage/assets",
  "raw.githubusercontent.com/gethomepage/homepage",
  "user-images.githubusercontent.com",
  "github-production-user-asset",
];

const markdownExtensions = new Set([".md", ".mdx"]);
const builtExtensions = new Set([".html"]);
const errors = [];

function walkFiles(dir, extensions) {
  if (!existsSync(dir)) return [];

  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath, extensions));
      continue;
    }
    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function newestMtime(files) {
  let newest = 0;
  for (const filePath of files) {
    newest = Math.max(newest, statSync(filePath).mtimeMs);
  }
  return newest;
}

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function addError(filePath, lineNumber, message) {
  errors.push(`${relativePath(filePath)}:${lineNumber}: ${message}`);
}

function lineNumberForOffset(content, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function assertNoForbiddenFragments(filePath, content) {
  for (const fragment of forbiddenAssetFragments) {
    let offset = content.indexOf(fragment);
    while (offset !== -1) {
      addError(filePath, lineNumberForOffset(content, offset), `forbidden upstream asset reference: ${fragment}`);
      offset = content.indexOf(fragment, offset + fragment.length);
    }
  }
}

function assertNoRemoteImageSyntax(filePath, content) {
  const patterns = [/!\[[^\]]*\]\(\s*https?:\/\/[^)\s]+/giu, /<img\b[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>/giu];

  for (const pattern of patterns) {
    let match = pattern.exec(content);
    while (match) {
      addError(filePath, lineNumberForOffset(content, match.index), "remote image references are not allowed in docs");
      match = pattern.exec(content);
    }
  }
}

function assertAllowedDocsAssets(filePath, content) {
  const docsAssetPattern = /\/(?:Daemun\/)?docs-assets\/([^)"'\s>]+)/giu;
  let match = docsAssetPattern.exec(content);
  while (match) {
    const assetName = path.basename(match[1]);
    if (!allowedDocsAssets.has(assetName)) {
      addError(filePath, lineNumberForOffset(content, match.index), `unapproved docs asset reference: ${assetName}`);
    }
    match = docsAssetPattern.exec(content);
  }
}

function auditSourceDocs() {
  for (const filePath of walkFiles(docsContentDir, markdownExtensions)) {
    const content = readFileSync(filePath, "utf8");
    assertNoForbiddenFragments(filePath, content);
    assertNoRemoteImageSyntax(filePath, content);
    assertAllowedDocsAssets(filePath, content);
  }
}

function auditPublicDocsAssets() {
  if (!existsSync(publicDocsAssetsDir)) return;

  for (const entry of readdirSync(publicDocsAssetsDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!allowedDocsAssets.has(entry.name)) {
      errors.push(`public/docs-assets/${entry.name}: unapproved docs asset file`);
    }
  }
}

function auditBuiltDocs() {
  if (!existsSync(distDocsDir)) return;

  const sourceFiles = walkFiles(docsContentDir, markdownExtensions);
  const builtFiles = walkFiles(distDocsDir, builtExtensions);
  if (builtFiles.length === 0) return;

  if (newestMtime(builtFiles) < newestMtime(sourceFiles)) {
    console.log("Skipping stale dist-docs asset audit; run `pnpm docs:build` to audit built HTML.");
    return;
  }

  for (const filePath of builtFiles) {
    const content = readFileSync(filePath, "utf8");
    assertNoForbiddenFragments(filePath, content);
    assertNoRemoteImageSyntax(filePath, content);
    assertAllowedDocsAssets(filePath, content);
  }
}

auditSourceDocs();
auditPublicDocsAssets();
auditBuiltDocs();

if (errors.length > 0) {
  console.error("Docs asset audit failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Docs asset audit passed: no upstream or remote image assets found.");
