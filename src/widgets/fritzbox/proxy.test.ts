import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { httpProxy, getServiceWidget, logger } = vi.hoisted(() => ({
  httpProxy: vi.fn(),
  getServiceWidget: vi.fn(),
  logger: { debug: vi.fn() },
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

import fritzboxProxyHandler from "./proxy";

describe("widgets/fritzbox/proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the configured fields and returns derived data", async () => {
    getServiceWidget.mockResolvedValue({
      url: "http://fritz.box",
      fields: ["connectionStatus", "uptime"],
    });

    httpProxy.mockResolvedValueOnce([
      200,
      "text/xml",
      Buffer.from(
        [
          "<?xml version='1.0' encoding='utf-8'?>",
          "<s:Envelope xmlns:s='http://schemas.xmlsoap.org/soap/envelope/'>",
          "<s:Body>",
          "<u:GetStatusInfoResponse xmlns:u='urn:schemas-upnp-org:service:WANIPConnection:1'>",
          "<NewConnectionStatus>Connected</NewConnectionStatus>",
          "<NewUptime>42</NewUptime>",
          "</u:GetStatusInfoResponse>",
          "</s:Body>",
          "</s:Envelope>",
        ].join(""),
      ),
    ]);

    const req = { query: { group: "g", service: "svc", index: "0" } };
    const res = createMockRes();

    await fritzboxProxyHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        connectionStatus: "Connected",
        uptime: "42",
      }),
    );
  });
});
