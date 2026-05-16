import { CoreV1Api } from "@kubernetes/client-node";

import { getKubeConfig } from "utils/config/kubernetes";
import createLogger from "utils/logger";

interface KubernetesStatusResult {
  statusCode: number;
  payload: Record<string, unknown>;
  kc?: ReturnType<typeof getKubeConfig>;
  pods?: unknown[];
}

const logger = createLogger("kubernetesStatusService");
const APP_LABEL = "app.kubernetes.io/name";
const inFlightKubernetesStatus = new Map<string, Promise<KubernetesStatusResult>>();

export function kubernetesLabelSelector(appName, podSelector) {
  return podSelector !== undefined ? podSelector : `${APP_LABEL}=${appName}`;
}

export function statusFromPods(pods) {
  const someReady = pods.find((pod) => ["Succeeded", "Running"].includes(pod.status.phase));
  const allReady = pods.every((pod) => ["Succeeded", "Running"].includes(pod.status.phase));
  if (allReady) return "running";
  if (someReady) return "partial";
  return "down";
}

function kubernetesStatusKey(namespace, appName, podSelector) {
  return `${namespace ?? ""}\0${appName ?? ""}\0${podSelector ?? ""}`;
}

export function clearKubernetesStatusInFlight() {
  inFlightKubernetesStatus.clear();
}

async function resolveKubernetesStatusUncached(namespace, appName, podSelector) {
  const labelSelector = kubernetesLabelSelector(appName, podSelector);
  const kc = getKubeConfig();
  if (!kc) {
    return {
      statusCode: 500,
      payload: { error: "No kubernetes configuration" },
    };
  }

  const coreApi = kc.makeApiClient(CoreV1Api);
  const podsResponse = await coreApi
    .listNamespacedPod({
      namespace,
      labelSelector,
    })
    .catch((err) => {
      logger.error("Error getting pods: %d %s %s", err.statusCode, err.body, err.response);
      return null;
    });

  if (!podsResponse) {
    return {
      statusCode: 500,
      payload: { error: "Error communicating with kubernetes" },
    };
  }

  const pods = podsResponse.items;
  if (pods.length === 0) {
    logger.error(`no pods found with namespace=${namespace} and labelSelector=${labelSelector}`);
    return {
      statusCode: 404,
      payload: { status: "not found" },
    };
  }

  return {
    statusCode: 200,
    payload: { status: statusFromPods(pods) },
    kc,
    pods,
  };
}

export function resolveKubernetesStatus(namespace, appName, podSelector) {
  const cacheKey = kubernetesStatusKey(namespace, appName, podSelector);
  const cached = inFlightKubernetesStatus.get(cacheKey);
  if (cached) return cached;

  const promise = Promise.resolve().then(() => resolveKubernetesStatusUncached(namespace, appName, podSelector));
  inFlightKubernetesStatus.set(cacheKey, promise);
  void promise.then(
    () => {
      if (inFlightKubernetesStatus.get(cacheKey) === promise) inFlightKubernetesStatus.delete(cacheKey);
    },
    () => {
      if (inFlightKubernetesStatus.get(cacheKey) === promise) inFlightKubernetesStatus.delete(cacheKey);
    },
  );
  return promise;
}
