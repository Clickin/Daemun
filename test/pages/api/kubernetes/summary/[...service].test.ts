import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { getKubeConfig, coreApi, metricsApi, MetricsCtor, logger } = vi.hoisted(() => {
  const metricsApi = {
    getPodMetrics: vi.fn<VitestMockProcedure>(),
  };

  function MetricsCtor() {
    return metricsApi;
  }

  return {
    getKubeConfig: vi.fn<VitestMockProcedure>(),
    coreApi: { listNamespacedPod: vi.fn<VitestMockProcedure>() },
    metricsApi,
    MetricsCtor,
    logger: { error: vi.fn<VitestMockProcedure>() },
  };
});

vi.mock("@kubernetes/client-node", () => ({
  CoreV1Api: function CoreV1Api() {},
  Metrics: MetricsCtor,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

vi.mock("utils/config/kubernetes", () => ({
  getKubeConfig,
}));

import handler from "pages/api/kubernetes/summary/[...service]";
import statusHandler from "pages/api/kubernetes/status/[...service]";
import { clearKubernetesStatusInFlight } from "pages/api/kubernetes/status-shared";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("pages/api/kubernetes/summary/[...service]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearKubernetesStatusInFlight();
    getKubeConfig.mockReturnValue({
      makeApiClient: () => coreApi,
    });
  });

  it("returns 400 when namespace/appName params are missing", async () => {
    const req = { query: { service: [] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "kubernetes query parameters are required" });
  });

  it("returns 500 when kubernetes is not configured", async () => {
    getKubeConfig.mockReturnValue(null);

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "No kubernetes configuration" });
  });

  it("returns status and stats using one pod list", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({
      items: [
        {
          metadata: { name: "pod-a" },
          spec: { containers: [{ resources: { limits: { cpu: "1000m", memory: "2Gi" } } }] },
          status: { phase: "Running" },
        },
        {
          metadata: { name: "pod-b" },
          spec: { containers: [{ resources: { limits: { cpu: "500m", memory: "1Gi" } } }] },
          status: { phase: "Pending" },
        },
      ],
    });
    metricsApi.getPodMetrics.mockResolvedValue({
      items: [
        { metadata: { name: "pod-a" }, containers: [{ usage: { cpu: "250m", memory: "100Mi" } }] },
        { metadata: { name: "pod-b" }, containers: [{ usage: { cpu: "500m", memory: "1Gi" } }] },
      ],
    });

    const req = { query: { service: ["default", "app"], podSelector: "app=test" } };
    const res = createMockRes();

    await handler(req, res);

    expect(coreApi.listNamespacedPod).toHaveBeenCalledTimes(1);
    expect(coreApi.listNamespacedPod).toHaveBeenCalledWith({
      namespace: "default",
      labelSelector: "app=test",
    });
    expect(metricsApi.getPodMetrics).toHaveBeenCalledWith("default");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("partial");
    expect(res.body.stats.cpuLimit).toBe(1.5);
    expect(res.body.stats.memLimit).toBe(3000000000);
    expect(res.body.stats.cpu).toBeCloseTo(0.75, 5);
    expect(res.body.stats.mem).toBe(1100000000);
  });

  it("returns 404 when no pods match the selector", async () => {
    coreApi.listNamespacedPod.mockResolvedValue({ items: [] });

    const req = { query: { service: ["default", "app"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ status: "not found" });
  });

  it("shares the in-flight pod lookup with the status endpoint without changing responses", async () => {
    const pods = deferred<{
      items: Array<{
        metadata: { name: string };
        spec: { containers: Array<{ resources: { limits: { cpu: string; memory: string } } }> };
        status: { phase: string };
      }>;
    }>();
    metricsApi.getPodMetrics.mockResolvedValue({
      items: [{ metadata: { name: "pod-a" }, containers: [{ usage: { cpu: "250m", memory: "100Mi" } }] }],
    });
    coreApi.listNamespacedPod.mockReturnValue(pods.promise);

    const statusRes = createMockRes();
    const summaryRes = createMockRes();
    const statusPromise = statusHandler({ query: { service: ["default", "app"], podSelector: "app=test" } }, statusRes);
    const summaryPromise = handler({ query: { service: ["default", "app"], podSelector: "app=test" } }, summaryRes);

    await Promise.resolve();
    expect(coreApi.listNamespacedPod).toHaveBeenCalledTimes(1);

    pods.resolve({
      items: [
        {
          metadata: { name: "pod-a" },
          spec: { containers: [{ resources: { limits: { cpu: "1000m", memory: "2Gi" } } }] },
          status: { phase: "Running" },
        },
      ],
    });
    await Promise.all([statusPromise, summaryPromise]);

    expect(coreApi.listNamespacedPod).toHaveBeenCalledTimes(1);
    expect(metricsApi.getPodMetrics).toHaveBeenCalledTimes(1);
    expect(statusRes.body).toEqual({ status: "running" });
    expect(summaryRes.body.status).toBe("running");
    expect(summaryRes.body.stats.cpuLimit).toBe(1);
  });
});
