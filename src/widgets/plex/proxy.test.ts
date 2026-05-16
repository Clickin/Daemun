import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { httpProxy, getServiceWidget, cache, logger } = vi.hoisted(() => {
  const store = new Map();
  return {
    httpProxy: vi.fn<VitestMockProcedure>(),
    getServiceWidget: vi.fn<VitestMockProcedure>(),
    cache: {
      get: vi.fn<VitestMockProcedure>((k) => (store.has(k) ? store.get(k) : null)),
      put: vi.fn<VitestMockProcedure>((k, v) => store.set(k, v)),
      del: vi.fn<VitestMockProcedure>((k) => store.delete(k)),
      _reset: () => store.clear(),
    },
    logger: { debug: vi.fn<VitestMockProcedure>(), error: vi.fn<VitestMockProcedure>() },
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
vi.mock("utils/cache", () => ({
  default: cache,
  ...cache,
}));
vi.mock("widgets/widgets", () => ({
  default: {
    plex: {
      api: "{url}{endpoint}",
    },
  },
}));

import plexProxyHandler from "./proxy";

describe("widgets/plex/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache._reset();
  });

  it("fetches sessions and library counts, caching intermediate results", async () => {
    getServiceWidget.mockResolvedValue({ type: "plex", url: "http://plex" });

    httpProxy
      // sessions
      .mockResolvedValueOnce([200, "application/xml", Buffer.from('<MediaContainer size="2" />')])
      // libraries
      .mockResolvedValueOnce([
        200,
        "application/xml",
        Buffer.from(
          [
            "<MediaContainer>",
            '<Directory type="movie" key="1" />',
            '<Directory type="show" key="2" />',
            '<Directory type="artist" key="3" />',
            "</MediaContainer>",
          ].join(""),
        ),
      ])
      // movies
      .mockResolvedValueOnce([200, "application/xml", Buffer.from('<MediaContainer size="10" />')])
      // tv
      .mockResolvedValueOnce([200, "application/xml", Buffer.from('<MediaContainer totalSize="20" />')])
      // albums
      .mockResolvedValueOnce([200, "application/xml", Buffer.from('<MediaContainer size="30" />')]);

    const req = { query: { group: "g", service: "svc", index: "0" } };
    const res = createMockRes();

    await plexProxyHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ streams: "2", albums: 30, movies: 10, tv: 20 });
    expect(cache.put).toHaveBeenCalled();
  });
});
