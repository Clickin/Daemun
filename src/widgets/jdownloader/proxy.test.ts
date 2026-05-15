import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { httpProxy, getServiceWidget, tools, logger } = vi.hoisted(() => ({
  httpProxy: vi.fn<VitestMockProcedure>(),
  getServiceWidget: vi.fn<VitestMockProcedure>(),
  tools: {
    uniqueRid: vi.fn<VitestMockProcedure>(() => 123),
    sha256: vi.fn<VitestMockProcedure>(() => "secret"),
    validateRid: vi.fn<VitestMockProcedure>(() => true),
    createEncryptionToken: vi.fn<VitestMockProcedure>(() => "enc-token"),
    decrypt: vi.fn<VitestMockProcedure>((cipherText) => {
      if (cipherText === "connect") {
        return JSON.stringify({ rid: 123, sessiontoken: "sess" });
      }
      if (cipherText === "devices") {
        return JSON.stringify({ list: [{ name: "myclient", id: "dev1" }] });
      }
      if (cipherText === "packages") {
        return JSON.stringify({
          data: [
            { bytesLoaded: 40, bytesTotal: 100, finished: false, speed: 10 },
            { bytesLoaded: 100, bytesTotal: 100, finished: true, speed: 0 },
          ],
        });
      }
      return JSON.stringify({});
    }),
    encrypt: vi.fn<VitestMockProcedure>(() => "encrypted-body"),
  },
  logger: { debug: vi.fn<VitestMockProcedure>(), error: vi.fn<VitestMockProcedure>() },
}));

vi.mock("./tools", () => tools);
vi.mock("utils/logger", () => ({
  default: () => logger,
}));
vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));
vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));

import jdownloaderProxyHandler from "./proxy";

describe("widgets/jdownloader/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates package stats from the JDownloader API", async () => {
    getServiceWidget.mockResolvedValue({
      url: "http://ignored",
      username: "user@example.com",
      password: "pw",
      client: "myclient",
    });

    httpProxy
      .mockResolvedValueOnce([200, "application/json", Buffer.from("connect")])
      .mockResolvedValueOnce([200, "application/json", Buffer.from("devices")])
      .mockResolvedValueOnce([200, "application/json", Buffer.from("packages")]);

    const req = { query: { group: "g", service: "svc", index: "0" } };
    const res = createMockRes();

    await jdownloaderProxyHandler(req, res);

    expect(httpProxy).toHaveBeenCalledTimes(3);
    expect(res.body).toEqual({
      downloadCount: 2,
      bytesRemaining: 60,
      totalBytes: 200,
      totalSpeed: 10,
    });
  });
});
