import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baselinePath = path.join(root, "tools/release-gate/upstream-baseline.json");
const contractMapPath = path.join(root, "tools/release-gate/upstream-contract-map.json");
const upstreamTestPattern = /^src\/__tests__\/pages\/.+\.test\.(?:js|jsx|ts|tsx)$/;

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function listFromGit(commit) {
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", commit, "src/__tests__/pages"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => upstreamTestPattern.test(line))
    .sort();
}

function repositorySlug(repository) {
  const match = repository.match(/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (!match) {
    throw new Error(`Unsupported upstream repository URL: ${repository}`);
  }
  return match[1];
}

async function listFromGitHub(baseline) {
  const slug = repositorySlug(baseline.repository);
  const response = await fetch(`https://api.github.com/repos/${slug}/git/trees/${baseline.commit}?recursive=1`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "daemun-release-gate" },
  });

  if (!response.ok) {
    throw new Error(`GitHub tree request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return payload.tree
    .map((entry) => entry.path)
    .filter((entryPath) => upstreamTestPattern.test(entryPath))
    .sort();
}

async function listUpstreamTests(baseline) {
  try {
    return listFromGit(baseline.commit);
  } catch {
    return listFromGitHub(baseline);
  }
}

function collectContractProblems(upstreamTests, contractMap) {
  const problems = [];
  const upstreamSet = new Set(upstreamTests);
  const seen = new Set();
  const duplicatePaths = new Set();

  for (const contract of contractMap.contracts) {
    if (seen.has(contract.upstreamPath)) {
      duplicatePaths.add(contract.upstreamPath);
    }
    seen.add(contract.upstreamPath);

    if (!Array.isArray(contract.contractPaths) || contract.contractPaths.length === 0) {
      problems.push(`No Daemun contract path is defined for ${contract.upstreamPath}`);
      continue;
    }

    for (const contractPath of contract.contractPaths) {
      const absolutePath = path.join(root, contractPath);
      if (!existsSync(absolutePath)) {
        problems.push(`Missing Daemun contract file for ${contract.upstreamPath}: ${contractPath}`);
      }
    }
  }

  for (const upstreamPath of upstreamTests) {
    if (!seen.has(upstreamPath)) {
      problems.push(`Missing Daemun contract mapping for upstream test: ${upstreamPath}`);
    }
  }

  for (const contract of contractMap.contracts) {
    if (!upstreamSet.has(contract.upstreamPath)) {
      problems.push(`Stale Daemun contract mapping; upstream baseline no longer has: ${contract.upstreamPath}`);
    }
  }

  for (const upstreamPath of duplicatePaths) {
    problems.push(`Duplicate Daemun contract mapping for upstream test: ${upstreamPath}`);
  }

  return problems;
}

const baseline = await readJson(baselinePath);
const contractMap = await readJson(contractMapPath);
const upstreamTests = await listUpstreamTests(baseline);
const problems = collectContractProblems(upstreamTests, contractMap);

if (problems.length > 0) {
  console.error(`Daemun upstream contract gate failed for ${baseline.repository}@${baseline.commit}`);
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

const localContractCount = new Set(
  contractMap.contracts.flatMap((contract) =>
    contract.contractPaths.map((contractPath) => normalizePath(contractPath)),
  ),
).size;

console.log(
  `Daemun upstream contract gate passed: ${upstreamTests.length} upstream page tests mapped to ${localContractCount} local contract files.`,
);
