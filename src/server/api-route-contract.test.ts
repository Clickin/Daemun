import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cachedRequest, getServiceWidget, httpProxy, proxyHandler } = vi.hoisted(() => ({
  cachedRequest: vi.fn<VitestMockProcedure>(async () => ({ forecast: true })),
  getServiceWidget: vi.fn<VitestMockProcedure>(async () => ({ type: "routeproxy" })),
  httpProxy: vi.fn<VitestMockProcedure>(),
  proxyHandler: vi.fn<VitestMockProcedure>(async (req, res) =>
    res.status(202).json({
      body: req.body,
      group: req.query.group,
      header: req.headers["x-test"],
      method: req.method,
      service: req.query.service,
    }),
  ),
}));

const { dockerState, DockerCtor, getDockerArguments } = vi.hoisted(() => {
  const dockerState = {
    dockerArgs: { conn: { host: "dockerproxy", port: 2375 }, swarm: false },
    stats: { cpu_stats: { cpu_usage: { total_usage: 1 } } },
  };

  function DockerCtor() {
    return {
      listContainers: vi.fn<VitestMockProcedure>(async () => [{ Names: ["/nginx"], Id: "cid1" }]),
      getContainer: vi.fn<VitestMockProcedure>(() => ({
        stats: vi.fn<VitestMockProcedure>(async () => dockerState.stats),
      })),
    };
  }

  return {
    dockerState,
    DockerCtor,
    getDockerArguments: vi.fn<VitestMockProcedure>(() => dockerState.dockerArgs),
  };
});

vi.mock("dockerode", () => ({
  default: DockerCtor,
}));

vi.mock("utils/config/docker", () => ({
  default: getDockerArguments,
}));

const { coreApi, getKubeConfig, MetricsCtor, metricsApi } = vi.hoisted(() => {
  const coreApi = {
    listNamespacedPod: vi.fn<VitestMockProcedure>(),
  };
  const metricsApi = {
    getPodMetrics: vi.fn<VitestMockProcedure>(),
  };

  return {
    coreApi,
    getKubeConfig: vi.fn<VitestMockProcedure>(() => ({
      makeApiClient: () => coreApi,
    })),
    MetricsCtor: vi.fn<VitestMockProcedure>(() => metricsApi),
    metricsApi,
  };
});

vi.mock("@kubernetes/client-node", () => ({
  CoreV1Api: function CoreV1Api() {},
  Metrics: MetricsCtor,
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

const { getProxmoxConfig } = vi.hoisted(() => ({
  getProxmoxConfig: vi.fn<VitestMockProcedure>(),
}));

vi.mock("utils/config/proxmox", () => ({
  getProxmoxConfig,
}));

vi.mock("./home-props", () => ({
  loadHomePageProps: vi.fn<VitestMockProcedure>(async () => ({
    fallback: {},
    initialSettings: {},
    locale: "en",
  })),
}));

vi.mock("utils/config/service-helpers", () => ({
  default: getServiceWidget,
}));

vi.mock("utils/proxy/http", async (importOriginal) => ({
  ...(await importOriginal()),
  cachedRequest,
  httpProxy,
}));

vi.mock("widgets/widgets", () => ({
  default: {
    routeproxy: {
      api: "{url}/{endpoint}",
      proxyHandler,
    },
  },
}));

describe("Hono API route contracts", () => {
  const originalAllowedHosts = process.env.HOMEPAGE_ALLOWED_HOSTS;

  beforeEach(() => {
    vi.clearAllMocks();
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [
        {
          metadata: { name: "nginx-pod" },
          spec: { containers: [{ resources: { limits: { cpu: "500m", memory: "128Mi" } } }] },
          status: { phase: "Running" },
        },
      ],
    });
    metricsApi.getPodMetrics.mockResolvedValue({
      items: [
        {
          metadata: { name: "nginx-pod" },
          containers: [{ usage: { cpu: "100m", memory: "64Mi" } }],
        },
      ],
    });
    getKubeConfig.mockReturnValue({
      makeApiClient: () => coreApi,
    });
    getProxmoxConfig.mockReturnValue({
      pve: { url: "https://pve.example", token: "user@pam!token", secret: "secret" },
    });
    httpProxy.mockResolvedValue([
      200,
      "application/json",
      Buffer.from(JSON.stringify({ data: { status: "running", cpu: 0.25, mem: 1024 } })),
    ]);
    process.env.HOMEPAGE_ALLOWED_HOSTS = "*";
  });

  afterEach(() => {
    process.env.HOMEPAGE_ALLOWED_HOSTS = originalAllowedHosts;
  });

  it("serves representative GET API routes through the Hono route table", async () => {
    const { createApp } = await import("./app");
    const app = createApp();

    const configCss = await app.request("/api/config/custom.css");
    expect(configCss.status).toBe(200);

    const search = await app.request("/api/search/searchSuggestion?query=hello&providerName=Unknown");
    expect(search.status).toBe(200);
    expect(await search.json()).toEqual(["hello", []]);

    const openmeteo = await app.request(
      "/api/widgets/openmeteo?latitude=1&longitude=2&units=metric&cache=7&timezone=UTC",
    );
    expect(openmeteo.status).toBe(200);
    expect(await openmeteo.json()).toEqual({ forecast: true });
    expect(cachedRequest).toHaveBeenCalledWith(
      "https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2&daily=sunrise,sunset&current_weather=true&temperature_unit=celsius&timezone=UTC",
      "7",
    );
  }, 10000);

  it("preserves JSON body, query, method, and headers for a proxy route", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/api/services/proxy?group=g&service=s&index=0", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test": "present",
      },
      body: JSON.stringify({ ok: true }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      body: { ok: true },
      group: "g",
      header: "present",
      method: "POST",
      service: "s",
    });
    expect(getServiceWidget).toHaveBeenCalledWith("g", "s", "0");
  });

  it("passes docker catch-all path segments to the Next-style API handler", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/api/docker/stats/nginx/my-docker");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stats: dockerState.stats });
    expect(getDockerArguments).toHaveBeenCalledWith("my-docker");
  });

  it("passes kubernetes catch-all path segments to status and stats handlers", async () => {
    const { createApp } = await import("./app");
    const app = createApp();

    const status = await app.request("/api/kubernetes/status/default/nginx?podSelector=app=nginx");
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ status: "running" });
    expect(coreApi.listNamespacedPod).toHaveBeenCalledWith({
      namespace: "default",
      labelSelector: "app=nginx",
    });

    const stats = await app.request("/api/kubernetes/stats/default/nginx");
    expect(stats.status).toBe(200);
    expect(await stats.json()).toEqual({
      stats: {
        cpu: 0.1,
        cpuLimit: 0.5,
        cpuUsage: 20,
        mem: 64000000,
        memLimit: 128000000,
        memUsage: 50,
      },
    });
    expect(metricsApi.getPodMetrics).toHaveBeenCalledWith("default");
  });

  it("passes proxmox catch-all path segments to the stats handler", async () => {
    const { createApp } = await import("./app");
    const response = await createApp().request("/api/proxmox/stats/pve/100?type=qemu");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "running", cpu: 0.25, mem: 1024 });
    expect(httpProxy).toHaveBeenCalledWith("https://pve.example/api2/json/nodes/pve/qemu/100/status/current", {
      method: "GET",
      headers: { Authorization: "PVEAPIToken=user@pam!token=secret" },
    });
  });
});
