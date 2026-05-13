import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, getSettings, servicesResponse, bookmarksResponse, widgetsResponse, logger } = vi.hoisted(() => {
  const state = { throwIn: null };
  const logger = { error: vi.fn() };

  return {
    bookmarksResponse: vi.fn(async () => {
      if (state.throwIn === "bookmarks") throw new Error("bookmarks failed");
      return [{ name: "bm" }];
    }),
    getSettings: vi.fn(() => ({ language: "en", providers: {}, title: "Homepage" })),
    logger,
    servicesResponse: vi.fn(async () => {
      if (state.throwIn === "services") throw new Error("services failed");
      return [{ name: "svc" }];
    }),
    state,
    widgetsResponse: vi.fn(async () => {
      if (state.throwIn === "widgets") throw new Error("widgets failed");
      return [{ type: "search" }];
    }),
  };
});

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/config", () => ({
  getSettings,
}));

vi.mock("utils/config/api-response", () => ({
  bookmarksResponse,
  servicesResponse,
  widgetsResponse,
}));

describe("loadHomePageProps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.throwIn = null;
  });

  it("returns initial settings and API fallbacks for Inertia props", async () => {
    getSettings.mockReturnValueOnce({ language: "en", providers: { x: 1 }, title: "Homepage" });

    const { loadHomePageProps } = await import("./home-props");
    const result = await loadHomePageProps();

    expect(result.initialSettings).toEqual({ language: "en", title: "Homepage" });
    expect(result.fallback["/api/services"]).toEqual([{ name: "svc" }]);
    expect(result.fallback["/api/bookmarks"]).toEqual([{ name: "bm" }]);
    expect(result.fallback["/api/widgets"]).toEqual([{ type: "search" }]);
    expect(result.fallback["/api/hash"]).toBe(false);
    expect(result.locale).toBe("en");
  });

  it("normalizes legacy language codes", async () => {
    getSettings.mockReturnValueOnce({ language: "zh-CN", providers: {} });

    const { loadHomePageProps } = await import("./home-props");
    const result = await loadHomePageProps();

    expect(result.initialSettings.language).toBe("zh-Hans");
    expect(result.locale).toBe("zh-Hans");
  });

  it("falls back to empty props on errors", async () => {
    state.throwIn = "services";

    const { loadHomePageProps } = await import("./home-props");
    const result = await loadHomePageProps();

    expect(result.initialSettings).toEqual({});
    expect(result.fallback["/api/services"]).toEqual([]);
    expect(result.fallback["/api/bookmarks"]).toEqual([]);
    expect(result.fallback["/api/widgets"]).toEqual([]);
    expect(result.locale).toBe("en");
    expect(logger.error).toHaveBeenCalled();
  });
});
