import { Metrics } from "@kubernetes/client-node";

import { parseCpu, parseMemory } from "../../../../utils/kubernetes/utils";
import createLogger from "../../../../utils/logger";
import { resolveKubernetesStatus } from "../status-shared";

const logger = createLogger("kubernetesSummaryService");

async function statsFromPods(namespace, pods, metricsApi) {
  const podNames = new Set();
  let cpuLimit = 0;
  let memLimit = 0;

  pods.forEach((pod) => {
    podNames.add(pod.metadata.name);
    pod.spec.containers.forEach((container) => {
      if (container?.resources?.limits?.cpu) {
        cpuLimit += parseCpu(container?.resources?.limits?.cpu);
      }
      if (container?.resources?.limits?.memory) {
        memLimit += parseMemory(container?.resources?.limits?.memory);
      }
    });
  });

  const namespaceMetrics = await metricsApi
    .getPodMetrics(namespace)
    .then((response) => response.items)
    .catch((err) => {
      if (err.statusCode !== 404) {
        logger.error("Error getting pod metrics: %d %s %s", err.statusCode, err.body, err.response);
      }
      return null;
    });

  const stats = {
    mem: 0,
    cpu: 0,
    cpuLimit: 0,
    memLimit: 0,
    cpuUsage: 0,
    memUsage: 0,
  };

  if (namespaceMetrics) {
    const podMetrics = namespaceMetrics.filter((item) => podNames.has(item.metadata.name));
    podMetrics.forEach((metrics) => {
      metrics.containers.forEach((container) => {
        stats.mem += parseMemory(container.usage.memory);
        stats.cpu += parseCpu(container.usage.cpu);
      });
    });
  }

  stats.cpuLimit = cpuLimit;
  stats.memLimit = memLimit;
  stats.cpuUsage = cpuLimit ? 100 * (stats.cpu / cpuLimit) : 0;
  stats.memUsage = memLimit ? 100 * (stats.mem / memLimit) : 0;
  return stats;
}

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
    if (result.statusCode !== 200) {
      res.status(result.statusCode).send(result.payload);
      return;
    }

    const metricsApi = new Metrics(result.kc);
    const stats = await statsFromPods(namespace, result.pods, metricsApi);
    res.status(200).json({
      ...result.payload,
      stats,
    });
  } catch (e) {
    if (e) logger.error(e);
    res.status(500).send({
      error: "unknown error",
    });
  }
}
