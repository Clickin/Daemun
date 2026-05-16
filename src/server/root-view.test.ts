import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { rootView } from "./root-view";

function readScriptJson(html, selector) {
  const scriptPattern = new RegExp(`<script ${selector}[^>]*>(.*?)<\\/script>`, "s");
  const match = html.match(scriptPattern);

  expect(match).not.toBeNull();
  return JSON.parse(match[1]);
}

describe("rootView", () => {
  const originalViteOrigin = process.env.VITE_DEV_SERVER_ORIGIN;
  const originalManifestPath = process.env.DAEMUN_CLIENT_MANIFEST_PATH;
  let tempDir: string | undefined;

  afterEach(() => {
    if (originalViteOrigin === undefined) {
      delete process.env.VITE_DEV_SERVER_ORIGIN;
    } else {
      process.env.VITE_DEV_SERVER_ORIGIN = originalViteOrigin;
    }

    if (originalManifestPath === undefined) {
      delete process.env.DAEMUN_CLIENT_MANIFEST_PATH;
    } else {
      process.env.DAEMUN_CLIENT_MANIFEST_PATH = originalManifestPath;
    }

    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  it("uses Vite dev assets when the Hono dev server is active", () => {
    process.env.VITE_DEV_SERVER_ORIGIN = "http://localhost:5173";

    const html = rootView({
      fallback: {},
      initialSettings: { title: "Daemun" },
      locale: "en",
    });

    expect(html).toContain('import RefreshRuntime from "http://localhost:5173/@react-refresh"');
    expect(html).toContain('src="http://localhost:5173/@vite/client"');
    expect(html).toContain('src="http://localhost:5173/src/client.tsx"');
  });

  it("renders the document-level PWA and custom asset contract", () => {
    const html = rootView({
      fallback: {},
      initialSettings: { color: "emerald", theme: "light", title: "Lab" },
      locale: "en",
    });

    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('meta name="viewport"');
    expect(html).toContain('meta name="mobile-web-app-capable" content="yes"');
    expect(html).toContain('link rel="manifest" href="/site.webmanifest?v=4"');
    expect(html).toContain('link rel="preload" href="/api/config/custom.css" as="style"');
    expect(html).toContain('link rel="stylesheet" href="/api/config/custom.css"');
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('<script src="/api/config/custom.js"></script>');
  });

  it("preloads the production static import closure from the Vite manifest", () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "daemun-root-view-"));
    const manifestDir = path.join(tempDir, ".vite");
    mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, "manifest.json");
    process.env.DAEMUN_CLIENT_MANIFEST_PATH = manifestPath;

    writeFileSync(
      manifestPath,
      JSON.stringify({
        "src/client.tsx": {
          css: ["assets/client.css"],
          file: "assets/client.js",
          imports: ["_vendor-react.js", "_shared.js"],
        },
        "_vendor-react.js": {
          file: "assets/vendor-react.js",
          imports: ["_runtime.js"],
        },
        "_shared.js": {
          file: "assets/shared.js",
          imports: ["_runtime.js"],
        },
        "_runtime.js": {
          file: "assets/runtime.js",
        },
      }),
    );

    const html = rootView({
      fallback: {},
      initialSettings: { title: "Daemun" },
      locale: "en",
    });

    expect(html).toContain('link rel="stylesheet" href="/assets/client.css"');
    expect(html).toContain('link rel="modulepreload" crossorigin href="/assets/vendor-react.js"');
    expect(html).toContain('link rel="modulepreload" crossorigin href="/assets/shared.js"');
    expect(html).toContain('link rel="modulepreload" crossorigin href="/assets/runtime.js"');
    expect(html.match(/href="\/assets\/runtime\.js"/g)).toHaveLength(1);
    expect(html.indexOf('href="/assets/vendor-react.js"')).toBeLessThan(html.indexOf('src="/assets/client.js"'));
  });

  it("bakes static query data without an Inertia page payload", () => {
    const html = rootView({
      initialSettings: { color: "emerald", title: "Lab" },
      fallback: {
        "/api/services": [{ name: "Service One" }],
        "/api/bookmarks": [{ name: "Bookmark One" }],
        "/api/widgets": [{ type: "search" }],
        "/api/validate": [],
        "/api/hash": "abc123",
        "/api/future": { keep: true },
      },
      locale: "en",
    });

    const bakedPageProps = readScriptJson(html, 'id="daemun-page-props"');
    const bakedQueryData = readScriptJson(html, 'id="daemun-query-data"');

    expect(bakedPageProps).toEqual({
      i: { color: "emerald", title: "Lab" },
      l: "en",
    });
    expect(bakedQueryData).toEqual({
      s: [{ name: "Service One" }],
      b: [{ name: "Bookmark One" }],
      w: [{ type: "search" }],
      v: [],
      h: "abc123",
    });
    expect(html).not.toContain('data-page="app"');
    expect(html).not.toContain('"component":"Home"');
    expect(html).not.toContain("/api/future");
    expect(html).toContain('link rel="stylesheet" href="/api/config/custom.css"');
    expect(html).toContain('<script src="/api/config/custom.js"></script>');
  });
});
