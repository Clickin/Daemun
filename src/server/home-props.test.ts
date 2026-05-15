import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, getSettings, servicesResponse, bookmarksResponse, widgetsResponse, checkAndCopyConfig, logger } =
  vi.hoisted(() => {
  const state = { throwIn: null };
  const logger = { error: vi.fn<VitestMockProcedure>() };

  return {
    bookmarksResponse: vi.fn<VitestMockProcedure>(async () => {
      if (state.throwIn === "bookmarks") throw new Error("bookmarks failed");
      return [{ name: "bm" }];
    }),
    checkAndCopyConfig: vi.fn<VitestMockProcedure>(() => true),
    getSettings: vi.fn<VitestMockProcedure>(() => ({ language: "en", providers: {}, title: "Daemun" })),
    logger,
    servicesResponse: vi.fn<VitestMockProcedure>(async () => {
      if (state.throwIn === "services") throw new Error("services failed");
      return [{ name: "svc" }];
    }),
    state,
    widgetsResponse: vi.fn<VitestMockProcedure>(async () => {
      if (state.throwIn === "widgets") throw new Error("widgets failed");
      return [{ type: "search" }];
    }),
  };
});

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/config", () => ({
  default: checkAndCopyConfig,
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
    getSettings.mockReturnValueOnce({ language: "en", providers: { x: 1 }, title: "Daemun" });

    const { loadHomePageProps } = await import("./home-props");
    const result = await loadHomePageProps();

    expect(result.initialSettings).toEqual({ language: "en", title: "Daemun" });
    expect(result.fallback["/api/services"]).toEqual([{ name: "svc" }]);
    expect(result.fallback["/api/bookmarks"]).toEqual([{ name: "bm" }]);
    expect(result.fallback["/api/widgets"]).toEqual([{ type: "search" }]);
    expect(result.fallback["/api/validate"]).toEqual([]);
    expect(result.fallback["/api/hash"]).toBe(false);
    expect(result.locale).toBe("en");
  });

  it("normalizes legacy language codes", async () => {
    getSettings.mockReturnValueOnce({ language: "zh-CN", providers: {}, title: "Daemun" });

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
    expect(result.fallback["/api/validate"]).toEqual([]);
    expect(result.locale).toBe("en");
    expect(logger.error).toHaveBeenCalled();
  });
});
