import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { si, logger } = vi.hoisted(() => ({
  si: {
    currentLoad: vi.fn<VitestMockProcedure>(),
    fsSize: vi.fn<VitestMockProcedure>(),
    mem: vi.fn<VitestMockProcedure>(),
    cpuTemperature: vi.fn<VitestMockProcedure>(),
    time: vi.fn<VitestMockProcedure>(),
    networkStats: vi.fn<VitestMockProcedure>(),
    networkInterfaceDefault: vi.fn<VitestMockProcedure>(),
  },
  logger: {
    debug: vi.fn<VitestMockProcedure>(),
    warn: vi.fn<VitestMockProcedure>(),
  },
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("systeminformation", () => ({ default: si }));

import handler from "pages/api/widgets/resources";

function deferred<T>(_sample?: T) {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("pages/api/widgets/resources", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns CPU load data", async () => {
    si.currentLoad.mockResolvedValueOnce({ currentLoad: 12.34, avgLoad: 1.23 });

    const req = { query: { type: "cpu" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.cpu).toEqual({ usage: 12.34, load: 1.23 });
  });

  it("returns 404 when requested disk target does not exist", async () => {
    si.fsSize.mockResolvedValueOnce([{ mount: "/" }]);

    const req = { query: { type: "disk", target: "/missing" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Resource not available." });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("returns disk info for the requested mount", async () => {
    si.fsSize.mockResolvedValueOnce([{ mount: "/data", size: 1 }]);

    const req = { query: { type: "disk", target: "/data" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.drive).toEqual({ mount: "/data", size: 1 });
  });

  it("returns memory, cpu temp and uptime", async () => {
    si.mem.mockResolvedValueOnce({ total: 10 });
    si.cpuTemperature.mockResolvedValueOnce({ main: 50 });
    si.time.mockResolvedValueOnce({ uptime: 123 });

    const resMem = createMockRes();
    await handler({ query: { type: "memory" } }, resMem);
    expect(resMem.statusCode).toBe(200);
    expect(resMem.body.memory).toEqual({ total: 10 });

    const resTemp = createMockRes();
    await handler({ query: { type: "cputemp" } }, resTemp);
    expect(resTemp.statusCode).toBe(200);
    expect(resTemp.body.cputemp).toEqual({ main: 50 });

    const resUptime = createMockRes();
    await handler({ query: { type: "uptime" } }, resUptime);
    expect(resUptime.statusCode).toBe(200);
    expect(resUptime.body.uptime).toBe(123);
  });

  it("returns 404 when requested network interface does not exist", async () => {
    si.networkStats.mockResolvedValueOnce([{ iface: "en0" }]).mockResolvedValueOnce([
      {
        iface: "missing",
        operstate: "unknown",
        rx_bytes: 0,
        rx_dropped: 0,
        rx_errors: 0,
        tx_bytes: 0,
        tx_dropped: 0,
        tx_errors: 0,
        rx_sec: null,
        tx_sec: null,
        ms: 0,
      },
    ]);

    const req = { query: { type: "network", interfaceName: "missing" } };
    const res = createMockRes();

    await handler(req, res);

    expect(si.networkStats).toHaveBeenNthCalledWith(1, "*");
    expect(si.networkStats).toHaveBeenNthCalledWith(2, "missing");
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Interface not found" });
  });

  it("falls back to direct named interface query when wildcard enumeration misses it", async () => {
    si.networkStats.mockResolvedValueOnce([{ iface: "eth0", rx_bytes: 1 }]).mockResolvedValueOnce([
      {
        iface: "eno1",
        operstate: "up",
        rx_bytes: 1000,
        rx_dropped: 0,
        rx_errors: 0,
        tx_bytes: 500,
        tx_dropped: 0,
        tx_errors: 0,
        rx_sec: null,
        tx_sec: null,
        ms: 0,
      },
    ]);

    const req = { query: { type: "network", interfaceName: "eno1" } };
    const res = createMockRes();

    await handler(req, res);

    expect(si.networkStats).toHaveBeenNthCalledWith(1, "*");
    expect(si.networkStats).toHaveBeenNthCalledWith(2, "eno1");
    expect(res.statusCode).toBe(200);
    expect(res.body.interface).toBe("eno1");
    expect(res.body.network).toEqual({
      iface: "eno1",
      operstate: "up",
      rx_bytes: 1000,
      rx_dropped: 0,
      rx_errors: 0,
      tx_bytes: 500,
      tx_dropped: 0,
      tx_errors: 0,
      rx_sec: null,
      tx_sec: null,
      ms: 0,
    });
  });

  it("returns default interface network stats", async () => {
    si.networkStats.mockResolvedValueOnce([{ iface: "en0", rx_bytes: 1 }]);
    si.networkInterfaceDefault.mockResolvedValueOnce("en0");

    const req = { query: { type: "network" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.interface).toBe("en0");
    expect(res.body.network).toEqual({ iface: "en0", rx_bytes: 1 });
  });

  it("returns a batch of requested resources from one request", async () => {
    si.currentLoad.mockResolvedValueOnce({ currentLoad: 12.34, avgLoad: 1.23 });
    si.mem.mockResolvedValueOnce({ total: 10, active: 4, available: 6 });
    si.fsSize.mockResolvedValueOnce([
      { mount: "/", size: 10, available: 4 },
      { mount: "/data", size: 20, available: 12 },
    ]);
    si.networkStats.mockResolvedValueOnce([{ iface: "en0", rx_sec: 1, tx_sec: 2 }]);
    si.networkInterfaceDefault.mockResolvedValueOnce("en0");

    const req = {
      query: {
        type: "batch",
        types: "cpu,memory,disk,network",
        disks: JSON.stringify(["/", "/data"]),
      },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      cpu: { cpu: { usage: 12.34, load: 1.23 } },
      memory: { memory: { total: 10, active: 4, available: 6 } },
      disks: {
        "/": { drive: { mount: "/", size: 10, available: 4 } },
        "/data": { drive: { mount: "/data", size: 20, available: 12 } },
      },
      network: { network: { iface: "en0", rx_sec: 1, tx_sec: 2 }, interface: "en0" },
    });
  });

  it("starts batch resource lookups before awaiting the first result", async () => {
    const started: string[] = [];
    const cpu = deferred({ currentLoad: 1, avgLoad: 0.1 });
    const memory = deferred({ total: 10, active: 1 });
    const cputemp = deferred({ main: 40 });

    si.currentLoad.mockImplementationOnce(() => {
      started.push("cpu");
      return cpu.promise;
    });
    si.mem.mockImplementationOnce(() => {
      started.push("memory");
      return memory.promise;
    });
    si.cpuTemperature.mockImplementationOnce(() => {
      started.push("cputemp");
      return cputemp.promise;
    });

    const res = createMockRes();
    const responsePromise = handler({ query: { type: "batch", types: "cpu,memory,cputemp" } }, res);
    await Promise.resolve();

    try {
      expect(started).toEqual(["cpu", "memory", "cputemp"]);
    } finally {
      cpu.resolve({ currentLoad: 1, avgLoad: 0.1 });
      memory.resolve({ total: 10, active: 1 });
      cputemp.resolve({ main: 40 });
    }

    await responsePromise;
    expect(res.statusCode).toBe(200);
    expect(res.body.cpu.cpu.usage).toBe(1);
    expect(res.body.memory.memory.total).toBe(10);
    expect(res.body.cputemp.cputemp.main).toBe(40);
  });

  it("returns 404 when the default interface cannot be found in networkStats", async () => {
    si.networkStats.mockResolvedValueOnce([{ iface: "en0", rx_bytes: 1 }]);
    si.networkInterfaceDefault.mockResolvedValueOnce("en1");

    const req = { query: { type: "network" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Default interface not found" });
  });

  it("returns 400 for an invalid type", async () => {
    const req = { query: { type: "nope" } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "invalid type" });
  });
});
