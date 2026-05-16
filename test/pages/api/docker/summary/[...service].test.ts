import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { state, DockerCtor, getDockerArguments, logger } = vi.hoisted(() => {
  const state = {
    docker: null,
    dockerCtorArgs: [],
    dockerArgs: { conn: { socketPath: "/var/run/docker.sock" }, swarm: false },
  };

  function DockerCtor(conn) {
    state.dockerCtorArgs.push(conn);
    return state.docker;
  }

  return {
    state,
    DockerCtor,
    getDockerArguments: vi.fn<VitestMockProcedure>(() => state.dockerArgs),
    logger: { error: vi.fn<VitestMockProcedure>(), warn: vi.fn<VitestMockProcedure>() },
  };
});

vi.mock("dockerode", () => ({
  default: DockerCtor,
}));

vi.mock("utils/config/docker", () => ({
  default: getDockerArguments,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

import handler from "pages/api/docker/summary/[...service]";
import statusHandler from "pages/api/docker/status/[...service]";
import { clearDockerStatusInFlight } from "pages/api/docker/status-shared";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("pages/api/docker/summary/[...service]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDockerStatusInFlight();
    state.dockerCtorArgs.length = 0;
    state.dockerArgs = { conn: { socketPath: "/var/run/docker.sock" }, swarm: false };
    state.docker = {
      listContainers: vi.fn<VitestMockProcedure>(),
      getContainer: vi.fn<VitestMockProcedure>(),
      getService: vi.fn<VitestMockProcedure>(),
      listTasks: vi.fn<VitestMockProcedure>(),
    };
  });

  it("returns 400 when container name/server params are missing", async () => {
    const req = { query: { service: [] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "docker query parameters are required" });
  });

  it("returns 500 when docker returns a non-array containers payload", async () => {
    state.docker.listContainers.mockResolvedValue(Buffer.from("bad"));

    const req = { query: { service: ["c", "local"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "query failed" });
  });

  it("combines status and stats for an existing container from one container list", async () => {
    const stats = { cpu_stats: { cpu_usage: { total_usage: 1 } } };
    const inspect = vi.fn<VitestMockProcedure>().mockResolvedValue({
      State: { Status: "running", Health: { Status: "healthy" } },
    });
    const statsFn = vi.fn<VitestMockProcedure>().mockResolvedValue(stats);

    state.docker.listContainers.mockResolvedValue([{ Names: ["/myapp"], Id: "cid1" }]);
    state.docker.getContainer.mockReturnValue({ inspect, stats: statsFn });

    const req = { query: { service: ["myapp", "local"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(getDockerArguments).toHaveBeenCalledWith("local");
    expect(state.docker.listContainers).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(statsFn).toHaveBeenCalledWith({ stream: false });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "running", health: "healthy", stats });
  });

  it("logs a stats-only error and returns the upstream error payload for the widget", async () => {
    state.docker.listContainers.mockResolvedValue([{ Names: ["/myapp"], Id: "cid1" }]);
    state.docker.getContainer.mockReturnValue({
      inspect: vi.fn<VitestMockProcedure>().mockResolvedValue({ State: { Status: "running" } }),
      stats: vi.fn<VitestMockProcedure>().mockRejectedValue(new Error("nope")),
    });

    const req = { query: { service: ["myapp", "local"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "running", health: undefined, error: "Unable to retrieve stats" });
    expect(logger.warn).toHaveBeenCalledWith("Unable to retrieve Docker stats for '%s': %s", "myapp", "nope");
  });

  it("reports replicated swarm service status without stats when no local task container is available", async () => {
    state.dockerArgs.swarm = true;
    state.docker.listContainers.mockResolvedValue([{ Names: ["/other"], Id: "local1" }]);
    state.docker.getService.mockReturnValue({
      inspect: vi.fn<VitestMockProcedure>().mockResolvedValue({ Spec: { Mode: { Replicated: { Replicas: "2" } } } }),
    });
    state.docker.listTasks.mockResolvedValue([{ Status: {} }]);

    const req = { query: { service: ["svc", "local"] } };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "partial 1/2" });
  });

  it("shares the in-flight status lookup with the status endpoint without changing responses", async () => {
    const containers = deferred<Array<{ Names: string[]; Id: string }>>();
    const stats = { cpu_stats: { cpu_usage: { total_usage: 1 } } };
    const inspect = vi.fn<VitestMockProcedure>().mockResolvedValue({
      State: { Status: "running", Health: { Status: "healthy" } },
    });
    const statsFn = vi.fn<VitestMockProcedure>().mockResolvedValue(stats);

    state.docker.listContainers.mockReturnValue(containers.promise);
    state.docker.getContainer.mockReturnValue({ inspect, stats: statsFn });

    const statusRes = createMockRes();
    const summaryRes = createMockRes();
    const statusPromise = statusHandler({ query: { service: ["myapp", "local"] } }, statusRes);
    const summaryPromise = handler({ query: { service: ["myapp", "local"] } }, summaryRes);

    await Promise.resolve();
    expect(state.docker.listContainers).toHaveBeenCalledTimes(1);

    containers.resolve([{ Names: ["/myapp"], Id: "cid1" }]);
    await Promise.all([statusPromise, summaryPromise]);

    expect(state.docker.listContainers).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(statsFn).toHaveBeenCalledTimes(1);
    expect(statusRes.body).toEqual({ status: "running", health: "healthy" });
    expect(summaryRes.body).toEqual({ status: "running", health: "healthy", stats });
  });
});
