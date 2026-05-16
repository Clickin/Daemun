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

function deferred<T>(_sample?: T) {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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
    expect(result.fallback).not.toHaveProperty("/api/hash");
    expect(result.locale).toBe("en");
    expect(servicesResponse).toHaveBeenCalledWith({ language: "en", providers: { x: 1 }, title: "Daemun" });
    expect(bookmarksResponse).toHaveBeenCalledWith({ language: "en", providers: { x: 1 }, title: "Daemun" });
  });

  it("normalizes legacy language codes", async () => {
    getSettings.mockReturnValueOnce({ language: "zh-CN", providers: {}, title: "Daemun" });

    const { loadHomePageProps } = await import("./home-props");
    const result = await loadHomePageProps();

    expect(result.initialSettings.language).toBe("zh-Hans");
    expect(result.locale).toBe("zh-Hans");
  });

  it("starts independent fallback loaders before awaiting the first result", async () => {
    const started: string[] = [];
    const services = deferred([{ name: "svc" }]);
    const bookmarks = deferred([{ name: "bm" }]);
    const widgets = deferred([{ type: "search" }]);

    servicesResponse.mockImplementationOnce(() => {
      started.push("services");
      return services.promise;
    });
    bookmarksResponse.mockImplementationOnce(() => {
      started.push("bookmarks");
      return bookmarks.promise;
    });
    widgetsResponse.mockImplementationOnce(() => {
      started.push("widgets");
      return widgets.promise;
    });

    const { loadHomePageProps } = await import("./home-props");
    const resultPromise = loadHomePageProps();
    await Promise.resolve();

    try {
      expect(started).toEqual(["services", "bookmarks", "widgets"]);
    } finally {
      services.resolve([{ name: "svc" }]);
      bookmarks.resolve([{ name: "bm" }]);
      widgets.resolve([{ type: "search" }]);
    }

    const result = await resultPromise;
    expect(result.fallback["/api/services"]).toEqual([{ name: "svc" }]);
    expect(result.fallback["/api/bookmarks"]).toEqual([{ name: "bm" }]);
    expect(result.fallback["/api/widgets"]).toEqual([{ type: "search" }]);
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
    expect(result.fallback).not.toHaveProperty("/api/hash");
    expect(result.locale).toBe("en");
    expect(logger.error).toHaveBeenCalled();
  });
});
