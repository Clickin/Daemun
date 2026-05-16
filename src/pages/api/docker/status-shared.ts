import Docker from "dockerode";

import getDockerArguments from "utils/config/docker";

interface DockerStatusResult {
  statusCode: number;
  payload: Record<string, unknown>;
  docker?: Docker;
  statsContainerId?: string;
}

function containerStatus(info) {
  return {
    status: info.State.Status,
    health: info.State.Health?.Status,
  };
}

function replicatedStatus(serviceInfo, tasks) {
  const replicas = parseInt(serviceInfo.Spec.Mode?.Replicated?.Replicas, 10);
  if (tasks.length === replicas) {
    return `running ${tasks.length}/${replicas}`;
  }
  if (tasks.length > 0) {
    return `partial ${tasks.length}/${replicas}`;
  }
  return null;
}

function taskContainerId(containers, tasks) {
  const localContainerIDs = containers.map((c) => c.Id);
  const task = tasks.find((t) => localContainerIDs.includes(t.Status?.ContainerStatus?.ContainerID)) ?? tasks.at(0);
  return {
    task,
    taskContainerId: task?.Status?.ContainerStatus?.ContainerID,
  };
}

const inFlightDockerStatus = new Map<string, Promise<DockerStatusResult>>();

function dockerStatusKey(containerName, containerServer) {
  return `${containerServer ?? ""}\0${containerName ?? ""}`;
}

export function clearDockerStatusInFlight() {
  inFlightDockerStatus.clear();
}

async function resolveDockerStatusUncached(containerName, containerServer) {
  const dockerArgs = containerServer ? getDockerArguments(containerServer) : { conn: getDockerArguments(), swarm: false };
  if (!dockerArgs) {
    return {
      statusCode: 404,
      payload: { status: "not found" },
    };
  }

  const docker = new Docker(dockerArgs.conn);
  const containers = await docker.listContainers({
    all: true,
  });

  if (!Array.isArray(containers)) {
    return {
      statusCode: 500,
      payload: { error: "query failed" },
    };
  }

  const containerNames = containers.flatMap((container) => container.Names.map((name) => name.replace(/^\//, "")));
  const containerExists = containerNames.includes(containerName);

  if (containerExists) {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();

    return {
      statusCode: 200,
      payload: containerStatus(info),
      docker,
      statsContainerId: containerName,
    };
  }

  if (dockerArgs.swarm) {
    const serviceInfo = await docker
      .getService(containerName)
      .inspect()
      .catch(() => undefined);

    if (!serviceInfo) {
      return {
        statusCode: 404,
        payload: { status: "not found" },
      };
    }

    const tasks = await docker
      .listTasks({
        filters: {
          service: [containerName],
          "desired-state": ["running"],
        },
      })
      .catch(() => []);

    if (serviceInfo.Spec.Mode?.Replicated) {
      const status = replicatedStatus(serviceInfo, tasks);
      if (status) {
        return {
          statusCode: 200,
          payload: { status },
          docker,
          statsContainerId: taskContainerId(containers, tasks).taskContainerId,
        };
      }
    } else {
      const { task, taskContainerId: swarmContainerId } = taskContainerId(containers, tasks);
      if (swarmContainerId) {
        try {
          const container = docker.getContainer(swarmContainerId);
          const info = await container.inspect();

          return {
            statusCode: 200,
            payload: containerStatus(info),
            docker,
            statsContainerId: swarmContainerId,
          };
        } catch {
          if (task) {
            return {
              statusCode: 200,
              payload: { status: task.Status.State },
            };
          }
        }
      }
    }
  }

  return {
    statusCode: 404,
    payload: { status: "not found" },
  };
}

export function resolveDockerStatus(containerName, containerServer) {
  const cacheKey = dockerStatusKey(containerName, containerServer);
  const cached = inFlightDockerStatus.get(cacheKey);
  if (cached) return cached;

  const promise = Promise.resolve().then(() => resolveDockerStatusUncached(containerName, containerServer));
  inFlightDockerStatus.set(cacheKey, promise);
  void promise.then(
    () => {
      if (inFlightDockerStatus.get(cacheKey) === promise) inFlightDockerStatus.delete(cacheKey);
    },
    () => {
      if (inFlightDockerStatus.get(cacheKey) === promise) inFlightDockerStatus.delete(cacheKey);
    },
  );
  return promise;
}
