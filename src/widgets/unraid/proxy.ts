import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";
import { asJson } from "utils/proxy/api-helpers";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("unraidProxyHandler");

interface UnraidApiCache {
  name?: string;
  fsType?: string | null;
  fsSize?: number | null;
  fsFree?: number | null;
  fsUsed?: number | null;
}

interface UnraidApiData {
  array?: {
    state?: string | null;
    capacity?: {
      kilobytes?: {
        free?: number | null;
        total?: number | null;
        used?: number | null;
      };
    };
    caches?: UnraidApiCache[];
  };
  metrics?: {
    memory?: {
      active?: number | null;
      available?: number | null;
      percentTotal?: number | null;
    };
    cpu?: {
      percentTotal?: number | null;
    };
  };
  notifications?: {
    overview?: {
      unread?: {
        total?: number | null;
      };
    };
  };
}

interface UnraidGraphqlResponse {
  data?: UnraidApiData;
}

interface UnraidCacheResponse {
  fsFree: number | null;
  fsUsed: number | null;
  fsUsedPercent: number | null;
}

interface UnraidProxyResponse {
  memoryUsedPercent: number | null;
  memoryUsed: number | null;
  memoryAvailable: number | null;
  cpuPercent: number | null;
  unreadNotifications: number | null;
  arrayState: string | null;
  arrayFree: number | null;
  arrayUsed: number | null;
  arrayUsedPercent: number | null;
  caches: Record<string, UnraidCacheResponse>;
}

const graphqlQuery = `
{
  array {
    state
    capacity {
      kilobytes {
        free
        total
        used
      }
    }
    caches {
      name
      fsType
      fsSize
      fsFree
      fsUsed
    }
  }
  metrics {
    memory {
      active
      available
      percentTotal
    }
    cpu {
      percentTotal
    }
  }
  notifications {
    overview {
      unread {
        total
      }
    }
  }
}
`;

function kilobytesToBytes(value: number | null | undefined): number | null {
  return value == null ? null : value * 1000;
}

function percent(used: number | null | undefined, total: number | null | undefined): number | null {
  if (used == null || total == null || total === 0) {
    return null;
  }

  return (used / total) * 100;
}

function processUnraidResponse(data: unknown): UnraidProxyResponse | { error: string } {
  const response: UnraidProxyResponse = {
    memoryUsedPercent: null,
    memoryUsed: null,
    memoryAvailable: null,
    cpuPercent: null,
    unreadNotifications: null,
    arrayState: null,
    arrayFree: null,
    arrayUsed: null,
    arrayUsedPercent: null,
    caches: {},
  };

  try {
    const parsed = asJson(data) as UnraidGraphqlResponse | undefined;
    const apiData = parsed?.data;

    response.memoryUsedPercent = apiData?.metrics?.memory?.percentTotal ?? null;
    response.memoryUsed = apiData?.metrics?.memory?.active ?? null;
    response.memoryAvailable = apiData?.metrics?.memory?.available ?? null;
    response.cpuPercent = apiData?.metrics?.cpu?.percentTotal ?? null;
    response.unreadNotifications = apiData?.notifications?.overview?.unread?.total ?? null;
    response.arrayState = apiData?.array?.state ?? null;
    response.arrayFree = kilobytesToBytes(apiData?.array?.capacity?.kilobytes?.free);
    response.arrayUsed = kilobytesToBytes(apiData?.array?.capacity?.kilobytes?.used);
    response.arrayUsedPercent = percent(
      apiData?.array?.capacity?.kilobytes?.used,
      apiData?.array?.capacity?.kilobytes?.total,
    );

    if (apiData?.array?.caches) {
      apiData.array.caches.forEach((cache) => {
        if (cache.fsType && cache.name) {
          response.caches[cache.name] = {
            fsFree: kilobytesToBytes(cache.fsFree),
            fsUsed: kilobytesToBytes(cache.fsUsed),
            fsUsedPercent: percent(cache.fsUsed, cache.fsSize),
          };
        }
      });
    }
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  return response;
}

export default async function unraidProxyHandler(req, res) {
  const { group, service, index } = req.query;

  if (!group || !service) {
    logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getServiceWidget(group, service, index);
  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const url = new URL(widget.url + "/graphql");

  const headers = {
    "Content-Type": "application/json",
    Accept: `application/json`,
    "X-API-Key": `${widget.key}`,
  };

  const params = {
    method: "POST",
    headers,
  };
  params.body = JSON.stringify({
    query: graphqlQuery,
  });

  const [status, , data] = await httpProxy(url, params);

  if (status === 204 || status === 304) {
    return res.status(status).end();
  }

  if (status !== 200) {
    logger.error(
      "Error getting data from Unraid for service '%s' in group '%s': %d.  Data: %s",
      service,
      group,
      status,
      data,
    );
    return res.status(status).send({ error: { message: "Error calling Unraid API.", data } });
  }

  const result = processUnraidResponse(data);
  if (result.error) {
    logger.error("Error processing Unraid data: %s", result.error);
    return res.status(500).json({ error: result.error });
  }

  res.setHeader("Content-Type", "application/json");
  return res.status(status).send(result);
}
