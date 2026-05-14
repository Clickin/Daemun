import { afterEach, describe, expect, it } from "vitest";

import { rootView } from "./root-view";

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
    expect(html).toContain('src="http://localhost:5173/src/client.jsx"');
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
});
