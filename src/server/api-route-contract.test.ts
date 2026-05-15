import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cachedRequest, getServiceWidget, proxyHandler } = vi.hoisted(() => ({
  cachedRequest: vi.fn<VitestMockProcedure>(async () => ({ forecast: true })),
  getServiceWidget: vi.fn<VitestMockProcedure>(async () => ({ type: "routeproxy" })),
  proxyHandler: vi.fn<VitestMockProcedure>(async (req, res) =>
    res.status(202).json({
      body: req.body,
      group: req.query.group,
      header: req.headers["x-test"],
      method: req.method,
      service: req.query.service,
    }),
  ),
}));

vi.mock("./home-props", () => ({
  loadHomePageProps: vi.fn<VitestMockProcedure>(async () => ({
    fallback: {},
    initialSettings: {},
    locale: "en",
  })),
}));

vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));

vi.mock("utils/proxy/http", async (importOriginal) => ({
  ...(await importOriginal()),
  cachedRequest,
}));

vi.mock("widgets/widgets", () => ({
  default: {
    routeproxy: {
      api: "{url}/{endpoint}",
      proxyHandler,
    },
  },
}));

describe("Hono API route contracts", () => {
  const originalAllowedHosts = process.env.HOMEPAGE_ALLOWED_HOSTS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOMEPAGE_ALLOWED_HOSTS = "*";
  });

  afterEach(() => {
    process.env.HOMEPAGE_ALLOWED_HOSTS = originalAllowedHosts;
  });

  it(
    "serves representative GET API routes through the Hono route table",
    async () => {
      const { createApp } = await import("./app");
      const app = createApp();

      const configCss = await app.request("/api/config/custom.css");
      expect(configCss.status).toBe(200);

      const search = await app.request("/api/search/searchSuggestion?query=hello&providerName=Unknown");
      expect(search.status).toBe(200);
      expect(await search.json()).toEqual(["hello", []]);

      const openmeteo = await app.request(
        "/api/widgets/openmeteo?latitude=1&longitude=2&units=metric&cache=7&timezone=UTC",
      );
      expect(openmeteo.status).toBe(200);
      expect(await openmeteo.json()).toEqual({ forecast: true });
      expect(cachedRequest).toHaveBeenCalledWith(
        "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&daily=sunrise,sunset&current_weather=true&temperature_unit=celsius&timezone=UTC",
        "7",
      );
    },
    10000,
  );

  it("preserves JSON body, query, method, and headers for a proxy route", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/api/services/proxy?group=g&service=s&index=0", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test": "present",
      },
      body: JSON.stringify({ ok: true }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      body: { ok: true },
      group: "g",
      header: "present",
      method: "POST",
      service: "s",
    });
    expect(getServiceWidget).toHaveBeenCalledWith("g", "s", "0");
  });
});
