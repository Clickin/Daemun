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
      props: { initialSettings: { title: "Homepage" } },
      url: "/",
      version: "test",
    });

    expect(html).toContain('import RefreshRuntime from "http://localhost:5173/@react-refresh"');
    expect(html).toContain('src="http://localhost:5173/@vite/client"');
    expect(html).toContain('src="http://localhost:5173/src/client.jsx"');
  });
});
