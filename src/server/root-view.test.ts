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

  afterEach(() => {
    process.env.VITE_DEV_SERVER_ORIGIN = originalViteOrigin;
  });

  it("uses Vite dev assets when the Hono dev server is active", () => {
    process.env.VITE_DEV_SERVER_ORIGIN = "http://localhost:5173";

    const html = rootView({
      component: "Home",
      props: { initialSettings: { title: "Daemun" } },
      url: "/",
      version: "test",
    });

    expect(html).toContain('import RefreshRuntime from "http://localhost:5173/@react-refresh"');
    expect(html).toContain('src="http://localhost:5173/@vite/client"');
    expect(html).toContain('src="http://localhost:5173/src/client.tsx"');
  });

  it("renders the document-level PWA and custom asset contract", () => {
    const html = rootView({
      component: "Home",
      props: { initialSettings: { color: "emerald", theme: "light", title: "Lab" } },
      url: "/",
      version: "test",
    });

    expect(html).toContain('meta name="viewport"');
    expect(html).toContain('meta name="mobile-web-app-capable" content="yes"');
    expect(html).toContain('link rel="manifest" href="/site.webmanifest?v=4"');
    expect(html).toContain('link rel="preload" href="/api/config/custom.css" as="style"');
    expect(html).toContain('link rel="stylesheet" href="/api/config/custom.css"');
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('<script src="/api/config/custom.js"></script>');
  });

  it("bakes static query data outside the Inertia page payload", () => {
    const html = rootView({
      component: "Home",
      props: {
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
      },
      url: "/",
      version: "test",
    });

    const bakedPageProps = readScriptJson(html, 'id="daemun-page-props"');
    const bakedQueryData = readScriptJson(html, 'id="daemun-query-data"');
    const inertiaPage = readScriptJson(html, 'data-page="app"');

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
    expect(inertiaPage.props.fallback).toEqual({ "/api/future": { keep: true } });
    expect(inertiaPage.props.initialSettings).toBeUndefined();
    expect(inertiaPage.props.locale).toBeUndefined();
    expect(JSON.stringify(inertiaPage)).not.toContain("Service One");
    expect(JSON.stringify(inertiaPage)).not.toContain("Bookmark One");
    expect(JSON.stringify(inertiaPage)).not.toContain("Lab");
    expect(html).toContain('link rel="stylesheet" href="/api/config/custom.css"');
    expect(html).toContain('<script src="/api/config/custom.js"></script>');
  });
});
