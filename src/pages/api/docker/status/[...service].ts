import createLogger from "utils/logger";
import { resolveDockerStatus } from "../status-shared";

const logger = createLogger("dockerStatusService");

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
    return res.status(result.statusCode).send(result.payload);
  } catch (e) {
    if (e) logger.error(e);
    return res.status(500).send({
      error: { message: e?.message ?? "Unknown error" },
    });
  }
}
