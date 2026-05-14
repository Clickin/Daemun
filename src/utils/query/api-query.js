import { useQuery } from "@tanstack/react-query";
import { hc } from "hono/client";

import { schemaForApiPath } from "./schemas";

function collectQuery(searchParams) {
  const query = {};

  for (const [key, value] of searchParams.entries()) {
    if (query[key] === undefined) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }

  return query;
}

function resolveUrl(path, baseUrl = "/") {
  const origin =
    baseUrl.startsWith("http://") || baseUrl.startsWith("https://")
      ? baseUrl
      : (globalThis.location?.origin ?? "http://localhost");

  return new URL(path, origin);
}

function rpcTargetForPath(client, pathname) {
  return pathname
    .split("/")
    .filter(Boolean)
    .reduce((target, segment) => target[segment], client);
}

async function readResponsePayload(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export class ApiResponseError extends Error {
  constructor(response, payload) {
    super(`API request failed with status ${response.status}`);
    this.name = "ApiResponseError";
    this.payload = payload;
    this.status = response.status;
  }
}

export class ApiValidationError extends Error {
  constructor(error) {
    super(`Invalid API response: ${error.issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ApiValidationError";
    this.cause = error;
  }
}

export async function rpcJson(path, schema = schemaForApiPath(path), { baseUrl = "/", fetch: fetcher, init } = {}) {
  const url = resolveUrl(path, baseUrl);
  const query = collectQuery(url.searchParams);
  const client = hc(baseUrl, { fetch: fetcher });
  const target = rpcTargetForPath(client, url.pathname);
  const args = Object.keys(query).length > 0 ? { query } : undefined;
  const response = await target.$get(args, { init });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new ApiResponseError(response, payload);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiValidationError(parsed.error);
  }

  return parsed.data;
}

export function apiQueryOptions(
  url,
  {
    baseUrl,
    enabled = true,
    fetch,
    fallbackData,
    immutable = false,
    initialData,
    queryKey,
    refreshInterval,
    schema,
    ...queryOptions
  } = {},
) {
  const isEnabled = Boolean(url) && enabled !== false;

  return {
    queryKey: queryKey ?? ["api", url ?? "disabled"],
    queryFn: () => rpcJson(url, schema ?? schemaForApiPath(url), { baseUrl, fetch }),
    enabled: isEnabled,
    initialData: initialData ?? fallbackData,
    refetchInterval: queryOptions.refetchInterval ?? refreshInterval,
    refetchOnMount: immutable ? false : queryOptions.refetchOnMount,
    refetchOnReconnect: immutable ? false : queryOptions.refetchOnReconnect,
    refetchOnWindowFocus: immutable ? false : queryOptions.refetchOnWindowFocus,
    staleTime: immutable ? Infinity : queryOptions.staleTime,
    ...queryOptions,
  };
}

export function useApiQuery(url, options) {
  const query = useQuery(apiQueryOptions(url, options));

  return {
    ...query,
    isValidating: query.isFetching,
    mutate: query.refetch,
  };
}
