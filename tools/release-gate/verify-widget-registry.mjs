import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baselinePath = path.join(root, "tools/release-gate/upstream-baseline.json");
const localWidgetRegistryPath = path.join(root, "src/widgets/widgets.ts");
const widgetRegistryPath = "src/widgets/widgets.js";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function repositorySlug(repository) {
  const match = repository.match(/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Unsupported upstream repository URL: ${repository}`);
  }
  return match[1];
}

function readFromGit(commit, filePath) {
  return execFileSync("git", ["show", `${commit}:${filePath}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

async function readFromGitHub(repository, ref, filePath) {
  const slug = repositorySlug(repository);
  const response = await fetch(`https://raw.githubusercontent.com/${slug}/${ref}/${filePath}`, {
    headers: { "user-agent": "daemun-release-gate" },
  });

  if (!response.ok) {
    throw new Error(`GitHub raw request failed for ${filePath}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function readUpstreamBaseline(baseline) {
  try {
    return readFromGit(baseline.commit, widgetRegistryPath);
  } catch {
    return readFromGitHub(baseline.repository, baseline.commit, widgetRegistryPath);
  }
}

function parseWidgetRegistry(source) {
  const importDirs = new Set();
  const registryKeys = new Set();

  for (const match of source.matchAll(/^import\s+\w+\s+from\s+"\.\/([^/]+)\/widget";$/gm)) {
    importDirs.add(match[1]);
  }

  const objectMatch = source.match(/const widgets = \{([\s\S]*?)\};\s*\n\s*export default widgets;/);
  if (!objectMatch) {
    throw new Error("Could not find `const widgets = { ... }` registry block.");
  }

  for (const line of objectMatch[1].split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)(?::\s*[A-Za-z0-9_]+)?,$/);
    if (match) {
      registryKeys.add(match[1]);
    }
  }

  return {
    importDirs: [...importDirs].sort(),
    registryKeys: [...registryKeys].sort(),
  };
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function collectBlockingProblems(upstreamBaseline, localRegistry) {
  const missingRegistryKeys = difference(upstreamBaseline.registryKeys, localRegistry.registryKeys);
  const missingImportDirs = difference(upstreamBaseline.importDirs, localRegistry.importDirs);
  const missingWidgetFiles = upstreamBaseline.importDirs.filter(
    (dir) => !existsSync(path.join(root, "src/widgets", dir, "widget.ts")),
  );

  return { missingImportDirs, missingRegistryKeys, missingWidgetFiles };
}

function hasBlockingProblems(problems) {
  return Object.values(problems).some((items) => items.length > 0);
}

function printProblems(problems) {
  for (const [name, items] of Object.entries(problems)) {
    if (items.length > 0) {
      console.error(`- ${name}: ${items.join(", ")}`);
    }
  }
}

async function reportUpstreamDrift(baseline, supportedRegistry) {
  const latestSource = await readFromGitHub(baseline.repository, baseline.branch, widgetRegistryPath);
  const latestRegistry = parseWidgetRegistry(latestSource);
  const addedKeys = difference(latestRegistry.registryKeys, supportedRegistry.registryKeys);
  const addedDirs = difference(latestRegistry.importDirs, supportedRegistry.importDirs);
  const removedKeys = difference(supportedRegistry.registryKeys, latestRegistry.registryKeys);
  const removedDirs = difference(supportedRegistry.importDirs, latestRegistry.importDirs);

  if (addedKeys.length || addedDirs.length || removedKeys.length || removedDirs.length) {
    console.log("Non-blocking upstream widget drift:");
    if (addedKeys.length) console.log(`- added registry keys: ${addedKeys.join(", ")}`);
    if (addedDirs.length) console.log(`- added widget dirs: ${addedDirs.join(", ")}`);
    if (removedKeys.length) console.log(`- removed registry keys: ${removedKeys.join(", ")}`);
    if (removedDirs.length) console.log(`- removed widget dirs: ${removedDirs.join(", ")}`);
    return;
  }

  console.log("Non-blocking upstream widget drift: none");
}

const baseline = await readJson(baselinePath);
const upstreamSource = await readUpstreamBaseline(baseline);
const localSource = readFileSync(localWidgetRegistryPath, "utf8");
const upstreamBaseline = parseWidgetRegistry(upstreamSource);
const localRegistry = parseWidgetRegistry(localSource);
const problems = collectBlockingProblems(upstreamBaseline, localRegistry);

if (hasBlockingProblems(problems)) {
  console.error(
    `Daemun widget registry gate failed against supported baseline ${baseline.repository}@${baseline.commit}`,
  );
  printProblems(problems);
  process.exit(1);
}

console.log(
  `Daemun widget registry gate passed: ${upstreamBaseline.registryKeys.length} supported registry keys and ${upstreamBaseline.importDirs.length} widget dirs present.`,
);

if (process.argv.includes("--report-upstream-drift")) {
  await reportUpstreamDrift(baseline, upstreamBaseline);
}
