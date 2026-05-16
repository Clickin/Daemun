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
    logger: { debug: vi.fn<VitestMockProcedure>(), error: vi.fn<VitestMockProcedure>() },
  };
});

vi.mock("utils/cache", () => ({
  default: cache,
  ...cache,
}));
vi.mock("utils/logger", () => ({
  default: () => logger,
}));
vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));
vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));

import qnapProxyHandler from "./proxy";

describe("widgets/qnap/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache._reset();
  });

  it("logs in and returns system + volume data", async () => {
    getServiceWidget.mockResolvedValue({ url: "http://qnap", username: "u", password: "p" });

    const loginXml = "<QDocRoot><authSid><![CDATA[sid1]]></authSid></QDocRoot>";
    const systemXml = [
      "<QDocRoot>",
      "<authPassed><![CDATA[1]]></authPassed>",
      "<func><ownContent><root><cpu><![CDATA[1]]></cpu></root></ownContent></func>",
      "</QDocRoot>",
    ].join("");
    const volumeXml = "<QDocRoot><authPassed><![CDATA[1]]></authPassed><volume><ok>true</ok></volume></QDocRoot>";

    httpProxy
      // login
      .mockResolvedValueOnce([200, "application/xml", Buffer.from(loginXml)])
      // system
      .mockResolvedValueOnce([200, "application/xml", Buffer.from(systemXml)])
      // volume
      .mockResolvedValueOnce([200, "application/xml", Buffer.from(volumeXml)]);

    const req = { query: { group: "g", service: "svc", index: "0" } };
    const res = createMockRes();

    await qnapProxyHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.system).toEqual({ cpu: { _text: "1", _cdata: "1" } });
    expect(res.body.volume).toEqual(
      expect.objectContaining({
        authPassed: expect.objectContaining({ _cdata: "1" }),
      }),
    );
  });
});
