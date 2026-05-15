import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { httpProxy, getServiceWidget, cache, logger } = vi.hoisted(() => {
  const store = new Map();

  return {
    httpProxy: vi.fn<VitestMockProcedure>(),
    getServiceWidget: vi.fn<VitestMockProcedure>(),
    cache: {
      get: vi.fn<VitestMockProcedure>((k) => store.get(k)),
      put: vi.fn<VitestMockProcedure>((k, v) => store.set(k, v)),
      del: vi.fn<VitestMockProcedure>((k) => store.delete(k)),
      _reset: () => store.clear(),
    },
    logger: {
      debug: vi.fn<VitestMockProcedure>(),
      error: vi.fn<VitestMockProcedure>(),
    },
  };
});

vi.mock("utils/logger", () => ({
  default: () => logger,
}));
vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));
vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));
vi.mock("memory-cache", () => ({
  default: cache,
  ...cache,
}));

import homeboxProxyHandler from "./proxy";

describe("widgets/homebox/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache._reset();
  });

  it("logs in and returns group statistics + currency", async () => {
    getServiceWidget.mockResolvedValue({
      url: "http://homebox",
      username: "u",
      password: "p",
    });

    httpProxy
      .mockResolvedValueOnce([
        200,
        "application/json",
        Buffer.from(JSON.stringify({ token: "tok", expiresAt: new Date(Date.now() + 60_000).toISOString() })),
      ])
      .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ totalItems: 1, totalUsers: 2 }))])
      .mockResolvedValueOnce([200, "application/json", Buffer.from(JSON.stringify({ currency: "USD" }))]);

    const req = { query: { group: "g", service: "svc", index: "0" } };
    const res = createMockRes();

    await homeboxProxyHandler(req, res);

    expect(httpProxy).toHaveBeenCalledTimes(3);
    expect(httpProxy.mock.calls[0][0]).toBe("http://homebox/api/v1/users/login");
    expect(res.statusCode).toBe(200);
    expect(res.body.currencyCode).toBe("USD");
    expect(res.body.users).toBe(2);
  });
});
