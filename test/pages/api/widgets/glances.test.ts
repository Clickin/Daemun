import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getPrivateWidgetOptions, httpProxy, logger } = vi.hoisted(() => ({
  getPrivateWidgetOptions: vi.fn<VitestMockProcedure>(),
  httpProxy: vi.fn<VitestMockProcedure>(),
  logger: { error: vi.fn<VitestMockProcedure>() },
}));

vi.mock("utils/config/widget-helpers", () => ({
  getPrivateWidgetOptions,
}));

vi.mock("utils/proxy/http", () => ({
  httpProxy,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

import handler from "pages/api/widgets/glances";

function glancesResponse(body: unknown) {
  return [200, null, Buffer.from(JSON.stringify(body))];
}

function deferredGlancesResponse(body: unknown) {
  let resolve: (value: [number, null, Buffer]) => void = () => {};
  const promise = new Promise<[number, null, Buffer]>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve: () => resolve(glancesResponse(body) as [number, null, Buffer]),
  };
}

function endpointFromUrl(url: string) {
  return url.split("/").at(-1);
}

describe("pages/api/widgets/glances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when the widget URL is missing", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({});

    const req = { query: { index: "0" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Missing Glances URL");
  });

  it("returns cpu/load/mem and includes optional endpoints when requested", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({ url: "http://glances", username: "u", password: "p" });

    httpProxy
      .mockResolvedValueOnce(glancesResponse({ total: 1 })) // cpu
      .mockResolvedValueOnce(glancesResponse({ avg: 2 })) // load
      .mockResolvedValueOnce(glancesResponse({ available: 3 })) // mem
      .mockResolvedValueOnce(glancesResponse("1 days")) // uptime
      .mockResolvedValueOnce(glancesResponse([{ label: "cpu_thermal", value: 50 }])) // sensors
      .mockResolvedValueOnce(glancesResponse([{ mnt_point: "/", percent: 1 }])); // fs

    const req = { query: { index: "0", uptime: "1", cputemp: "1", disk: "1", version: "4" } };
    const res = createMockRes();

    await handler(req, res);

    expect(httpProxy).toHaveBeenCalledWith(
      "http://glances/api/4/cpu",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: expect.any(String) }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      cpu: { total: 1 },
      load: { avg: 2 },
      mem: { available: 3 },
      uptime: "1 days",
      sensors: [{ label: "cpu_thermal", value: 50 }],
      fs: [{ mnt_point: "/", percent: 1 }],
    });
  });

  it("does not call optional endpoints unless requested", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({ url: "http://glances" });

    httpProxy
      .mockResolvedValueOnce(glancesResponse({ total: 1 })) // cpu
      .mockResolvedValueOnce(glancesResponse({ avg: 2 })) // load
      .mockResolvedValueOnce(glancesResponse({ available: 3 })); // mem

    const req = { query: { index: "0" } };
    const res = createMockRes();

    await handler(req, res);

    expect(httpProxy).toHaveBeenCalledTimes(3);
    expect(httpProxy.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(res.statusCode).toBe(200);
  });

  it("falls back to version 3 when version is invalid", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({ url: "http://glances" });

    httpProxy
      .mockResolvedValueOnce(glancesResponse({ total: 1 }))
      .mockResolvedValueOnce(glancesResponse({ avg: 2 }))
      .mockResolvedValueOnce(glancesResponse({ available: 3 }));

    const req = { query: { index: "0", version: "3/../../secret-endpoint" } };
    const res = createMockRes();

    await handler(req, res);

    expect(httpProxy).toHaveBeenCalledWith("http://glances/api/3/cpu", expect.any(Object));
    expect(res.statusCode).toBe(200);
  });

  it("returns 400 when glances returns 401", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({ url: "http://glances" });
    httpProxy
      .mockResolvedValueOnce([401, null, Buffer.from("nope")]) // cpu
      .mockResolvedValueOnce(glancesResponse({ avg: 2 })) // load
      .mockResolvedValueOnce(glancesResponse({ available: 3 })); // mem

    const req = { query: { index: "0" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.stringContaining("Authorization failure") }));
  });

  it("returns 400 when glances returns a non-200 status for a downstream call", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({ url: "http://glances" });

    httpProxy
      .mockResolvedValueOnce(glancesResponse({ total: 1 })) // cpu
      .mockResolvedValueOnce([500, null, Buffer.from("nope")]) // load
      .mockResolvedValueOnce(glancesResponse({ available: 3 })); // mem

    const req = { query: { index: "0" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.stringContaining("HTTP 500") }));
    expect(httpProxy).toHaveBeenCalledTimes(3);
  });

  it("starts required endpoint requests concurrently", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({ url: "http://glances" });
    const pending = {
      cpu: deferredGlancesResponse({ total: 1 }),
      load: deferredGlancesResponse({ avg: 2 }),
      mem: deferredGlancesResponse({ available: 3 }),
    };
    const started: (string | undefined)[] = [];

    httpProxy.mockImplementation((url: string) => {
      const endpoint = endpointFromUrl(url);
      started.push(endpoint);
      return pending[endpoint as keyof typeof pending].promise;
    });

    const req = { query: { index: "0" } };
    const res = createMockRes();
    const handlerPromise = handler(req, res);
    await Promise.resolve();

    expect(started).toEqual(["cpu", "load", "mem"]);
    expect(res.statusCode).toBeNull();

    pending.load.resolve();
    await Promise.resolve();
    expect(res.statusCode).toBeNull();

    pending.cpu.resolve();
    pending.mem.resolve();
    await handlerPromise;

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      cpu: { total: 1 },
      load: { avg: 2 },
      mem: { available: 3 },
    });
  });

  it("starts requested optional endpoints concurrently and skips omitted optional endpoints", async () => {
    getPrivateWidgetOptions.mockResolvedValueOnce({ url: "http://glances" });
    const pending = {
      cpu: deferredGlancesResponse({ total: 1 }),
      load: deferredGlancesResponse({ avg: 2 }),
      mem: deferredGlancesResponse({ available: 3 }),
      uptime: deferredGlancesResponse("1 days"),
      sensors: deferredGlancesResponse([{ label: "cpu_thermal", value: 50 }]),
    };
    const started: (string | undefined)[] = [];

    httpProxy.mockImplementation((url: string) => {
      const endpoint = endpointFromUrl(url);
      started.push(endpoint);
      return pending[endpoint as keyof typeof pending].promise;
    });

    const req = { query: { index: "0", uptime: "1", cputemp: "1" } };
    const res = createMockRes();
    const handlerPromise = handler(req, res);
    await Promise.resolve();

    expect(started).toEqual(["cpu", "load", "mem", "uptime", "sensors"]);
    expect(started).not.toContain("fs");

    pending.cpu.resolve();
    pending.load.resolve();
    pending.mem.resolve();
    pending.uptime.resolve();
    pending.sensors.resolve();
    await handlerPromise;

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      cpu: { total: 1 },
      load: { avg: 2 },
      mem: { available: 3 },
      uptime: "1 days",
      sensors: [{ label: "cpu_thermal", value: 50 }],
    });
  });
});
