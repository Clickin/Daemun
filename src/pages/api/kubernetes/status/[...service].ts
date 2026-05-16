import createLogger from "../../../../utils/logger";
import { resolveKubernetesStatus } from "../status-shared";

const logger = createLogger("kubernetesStatusService");

export default async function handler(req, res) {
  const { service, podSelector } = req.query;

  const [namespace, appName] = service;
  if (!namespace && !appName) {
    res.status(400).send({
      error: "kubernetes query parameters are required",
    });
    return;
  }
  try {
    const result = await resolveKubernetesStatus(namespace, appName, podSelector);
    res.status(result.statusCode).send(result.payload);
  } catch (e) {
    if (e) logger.error(e);
    res.status(500).send({
      error: "unknown error",
    });
  }
}
