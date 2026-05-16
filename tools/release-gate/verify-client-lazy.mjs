import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(root, "dist/client/.vite/manifest.json");
const packagePath = path.join(root, "package.json");
const lockfilePath = path.join(root, "pnpm-lock.yaml");
const defaultBudgetKiB = 700;

function parseBudgetKiB() {
  const budgetArg = process.argv.find((arg) => arg.startsWith("--budget-kib="));
  const value = budgetArg?.split("=")[1] ?? process.env.CLIENT_LAZY_INITIAL_JS_BUDGET_KIB ?? String(defaultBudgetKiB);
  const budgetKiB = Number(value);

  if (!Number.isFinite(budgetKiB) || budgetKiB <= 0) {
    throw new Error(`Invalid initial JS budget: ${value}`);
  }

  return budgetKiB;
}

function normalizeId(id) {
  return id.replaceAll("\\", "/");
}

function entryId(key, entry) {
  return normalizeId(entry.src ?? key);
}

function fileBase(entry, key) {
  return path.basename(normalizeId(entry.file ?? key));
}

function findClientEntryKey(manifest) {
  if (manifest["src/client.tsx"]) return "src/client.tsx";

  const match = Object.entries(manifest).find(([, entry]) => entry.isEntry && entry.src === "src/client.tsx");
  if (!match) {
    throw new Error("Could not find src/client.tsx in dist/client/.vite/manifest.json");
  }

  return match[0];
}

function collectStaticClosure(manifest, startKey) {
  const seen = new Set();
  const stack = [startKey];

  while (stack.length) {
    const key = stack.pop();
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = manifest[key];
    if (!entry) continue;

    for (const importedKey of entry.imports ?? []) {
      stack.push(importedKey);
    }
  }

  return seen;
}

function isAllowedVendorChunk(base) {
  return /^vendor-(i18n|query|react)-/.test(base);
}

function isBroadChunk(entry, key) {
  const base = fileBase(entry, key);

  if (/^(info-widgets|services|bookmarks|quicklaunch)-/.test(base)) return true;
  return /^vendor-/.test(base) && !isAllowedVendorChunk(base);
}

function isServiceWidgetComponent(id) {
  return /^src\/widgets\/[^/]+\/component\.[tj]sx?$/.test(id);
}

function isInitialCoreServiceComponent(id) {
  return id === "src/widgets/docker/component.tsx";
}

function isInfoWidgetComponent(id) {
  return /^src\/components\/widgets\/(?:datetime\/datetime|glances\/glances|greeting\/greeting|kubernetes\/kubernetes|logo\/logo|longhorn\/longhorn|openmeteo\/openmeteo|openweathermap\/weather|resources\/resources|search\/search|stocks\/stocks|unifi_console\/unifi_console|weather\/weather)\.[tj]sx?$/.test(
    id,
  );
}

function isWidgetComponent(entry, key) {
  const id = entryId(key, entry);
  return isServiceWidgetComponent(id) || isInfoWidgetComponent(id);
}

function isRegistryEntry(entry, key) {
  const id = entryId(key, entry);

  return (
    id === "src/widgets/components.ts" ||
    id === "src/components/widgets/widget-resolved.tsx" ||
    id === "src/components/widgets/widget.tsx" ||
    id === "src/components/services/widget-resolved.tsx" ||
    id === "src/components/services/widget.tsx"
  );
}

function describeEntry(entry, key) {
  return `${key}${entry?.file ? ` (${entry.file})` : ""}`;
}

function sumInitialLocalJs(manifest, initialClosure) {
  const files = new Set();

  for (const key of initialClosure) {
    const file = manifest[key]?.file;
    if (file?.endsWith(".js")) {
      files.add(file);
    }
  }

  let bytes = 0;
  for (const file of files) {
    bytes += statSync(path.join(root, "dist/client", file)).size;
  }

  return { bytes, files: [...files].sort() };
}

function collectProblems(manifest, clientEntryKey, budgetKiB) {
  const problems = [];
  const initialClosure = collectStaticClosure(manifest, clientEntryKey);

  for (const filePath of [packagePath, lockfilePath]) {
    const contents = readFileSync(filePath, "utf8");
    if (/\brecharts\b/.test(contents)) {
      problems.push(`${path.relative(root, filePath)} still references Recharts`);
    }
  }

  if (/\brecharts\b/i.test(JSON.stringify(manifest))) {
    problems.push("Client manifest still references Recharts");
  }

  for (const key of initialClosure) {
    const entry = manifest[key];
    if (!entry) continue;

    if (isBroadChunk(entry, key)) {
      problems.push(`Initial static import closure includes broad chunk ${describeEntry(entry, key)}`);
    }

    if (key !== clientEntryKey && isWidgetComponent(entry, key) && !isInitialCoreServiceComponent(entryId(key, entry))) {
      problems.push(`Initial static import closure includes lazy widget component ${describeEntry(entry, key)}`);
    }
  }

  for (const [key, entry] of Object.entries(manifest)) {
    if (!isWidgetComponent(entry, key)) continue;

    const componentClosure = collectStaticClosure(manifest, key);
    for (const importedKey of componentClosure) {
      if (importedKey === key) continue;
      const importedEntry = manifest[importedKey];
      if (importedEntry && isRegistryEntry(importedEntry, importedKey)) {
        problems.push(
          `Widget component ${describeEntry(entry, key)} statically depends on registry ${describeEntry(
            importedEntry,
            importedKey,
          )}`,
        );
      }
    }
  }

  const { bytes, files } = sumInitialLocalJs(manifest, initialClosure);
  const budgetBytes = budgetKiB * 1024;
  if (bytes > budgetBytes) {
    problems.push(
      `Initial local JS is ${(bytes / 1024).toFixed(1)} KiB across ${files.length} files, exceeding ${budgetKiB} KiB`,
    );
  }

  return { bytes, files, initialClosure, problems };
}

if (!existsSync(manifestPath)) {
  console.error("Client lazy gate requires dist/client/.vite/manifest.json. Run `pnpm build` first.");
  process.exit(1);
}

const budgetKiB = parseBudgetKiB();
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const clientEntryKey = findClientEntryKey(manifest);
const { bytes, files, initialClosure, problems } = collectProblems(manifest, clientEntryKey, budgetKiB);

if (problems.length) {
  console.error("Daemun client lazy gate failed:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(
  `Daemun client lazy gate passed: ${initialClosure.size} static entries, ${files.length} local JS files, ${(
    bytes / 1024
  ).toFixed(1)} KiB initial JS (budget ${budgetKiB} KiB).`,
);
