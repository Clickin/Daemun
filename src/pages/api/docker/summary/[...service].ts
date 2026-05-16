import createLogger from "utils/logger";
import { resolveDockerStatus } from "../status-shared";

const logger = createLogger("dockerSummaryService");

function attachStats(status, stats) {
  if (stats.ok) {
    return {
      ...status,
      stats: stats.value,
    };
  }

  return {
    ...status,
    error: "Unable to retrieve stats",
  };
}

function statsResult(container, containerId) {
  return container
    .stats({ stream: false })
    .then((value) => ({ ok: true, value }))
    .catch((error) => {
      logger.warn("Unable to retrieve Docker stats for '%s': %s", containerId, error?.message ?? "Unknown error");
      return { ok: false };
    });
}

export default async function handler(req, res) {
  const { service } = req.query;
  const [containerName, containerServer] = service;

  if (!containerName && !containerServer) {
    return res.status(400).send({
      error: "docker query parameters are required",
    });
  }

  try {
    const result = await resolveDockerStatus(containerName, containerServer);
    if (result.statusCode !== 200 || !result.statsContainerId || !result.docker) {
      return res.status(result.statusCode).send(result.payload);
    }

    const container = result.docker.getContainer(result.statsContainerId);
    const stats = await statsResult(container, result.statsContainerId);
    return res.status(200).json(attachStats(result.payload, stats));
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).send({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
